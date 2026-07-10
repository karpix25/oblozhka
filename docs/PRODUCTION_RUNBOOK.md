# Production runbook

Практический runbook для production/beta эксплуатации HookCover: Telegram bot, API/admin, worker, Postgres, Redis, S3-compatible storage и Platega.

Документ не фиксирует конкретный хостинг. Команды ниже рассчитаны на `docker compose` из корня репозитория. Если production запускается через Easypanel, systemd, Kubernetes или другой оркестратор, используй те же проверки и замени команды управления сервисами на эквиваленты платформы.

## 1. Карта сервисов

- `postgres` - основная БД, volume `postgres-data`.
- `redis` - BullMQ очереди и временное состояние, volume `redis-data`, включен AOF (`appendonly yes`).
- `api` - Fastify API, health/readiness/admin/Platega callback.
- `worker` - обработка очередей генерации, хуков, face-card.
- `bot` - Telegram bot.
- `admin` - Vite preview для админки.

Публичные API:

- `GET /health` - процесс API жив.
- `GET /ready` - API проверяет Postgres, Redis и очереди.
- `GET /queues/status` - состояние очередей; требует `Authorization: Bearer <ADMIN_TOKEN>`.
- `POST /payments/platega/callback` - callback Platega, публичный путь, но проверяет `x-merchantid` и `x-secret`.

## 2. Release checklist

Перед релизом:

- [ ] Убедиться, что релизная ветка содержит только ожидаемые изменения.
- [ ] Проверить, что migrations лежат в `packages/db/prisma/migrations`.
- [ ] Выполнить локально:

```bash
npm run typecheck
npm test
npm run build
```

- [ ] Если менялись тарифы/платежи/кредиты, отдельно проверить сценарии покупки, callback и отката платежа.
- [ ] Если менялись очереди/генерация, отдельно проверить worker на тестовой задаче.
- [ ] Проверить `.env.docker` или secret store production: нет `change-me`, пустых ключей и local URL.
- [ ] Проверить backup БД перед миграцией, если миграция меняет структуру данных.
- [ ] Перед миграцией `20260710000100_add_product_events_and_generation_timing` убедиться, что финансовый ledger не содержит дублей одного основания:

```sql
SELECT "userId", reason, "referenceId", COUNT(*)
FROM "CreditLedgerEntry"
WHERE "referenceId" IS NOT NULL
GROUP BY "userId", reason, "referenceId"
HAVING COUNT(*) > 1;
```

  Запрос должен вернуть 0 строк. Если он находит дубли, остановить deploy и сверить баланс пользователя с ledger; не удалять финансовые строки автоматически.
- [ ] Согласовать окно релиза, если ожидается downtime или долгие migrations.

Минимальные smoke-checks после сборки:

```bash
docker compose build
docker compose up -d postgres redis
docker compose run --rm api node scripts/db-setup.mjs
docker compose up -d api worker bot admin
curl -fsS http://127.0.0.1:${API_PORT:-3000}/health
curl -fsS http://127.0.0.1:${API_PORT:-3000}/ready
```

## 3. Deploy steps

Стандартный deploy через compose:

```bash
git fetch --all --prune
git checkout <release-branch-or-tag>
git pull --ff-only
docker compose build
docker compose up -d postgres redis
docker compose run --rm api node scripts/db-setup.mjs
docker compose up -d api worker bot admin
docker compose ps
```

Если production использует текущий compose как единый запуск, `api` сам выполняет database setup перед стартом через `scripts/run-with-database-url.mjs`. Для production предпочтителен `PRISMA_DB_SETUP_MODE=migrate`, а не `push`.

Проверки после deploy:

```bash
curl -fsS http://127.0.0.1:${API_PORT:-3000}/health
curl -fsS http://127.0.0.1:${API_PORT:-3000}/ready
curl -fsS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:${API_PORT:-3000}/queues/status
docker compose logs --tail=100 api
docker compose logs --tail=100 worker
docker compose logs --tail=100 bot
```

Гейт релиза считается пройденным, когда:

- `/ready` возвращает `ok: true`.
- В `docker compose ps` нет `unhealthy`/restart loop.
- В очередях нет быстро растущего `failed`, а `waiting`/`active` двигаются.
- Новый платеж в тестовом режиме Platega или проверенный callback проходит без `401`, `Payment was not found`, `amount mismatch`.
- Telegram bot отвечает на базовое действие пользователя.

## 4. Rollback

Безопасный rollback зависит от миграций. Не откатывай код вслепую, если новая миграция уже изменила схему.

Быстрый rollback приложения без отката БД:

```bash
git checkout <previous-good-tag-or-commit>
docker compose build
docker compose up -d api worker bot admin
curl -fsS http://127.0.0.1:${API_PORT:-3000}/ready
```

Когда rollback БД может быть нужен:

- миграция удалила/переименовала колонку;
- старый код не стартует на новой схеме;
- данные массово повреждены логикой релиза.

В этом случае:

- остановить `api`, `worker`, `bot`, чтобы не писать новые данные;
- снять текущий аварийный snapshot;
- восстановить последний проверенный backup по `docs/BACKUP_RESTORE.md`;
- поднять предыдущий good build;
- проверить `/ready`, платежи, баланс тестового пользователя и очереди.

Команды остановки app-слоя:

```bash
docker compose stop api worker bot admin
docker compose ps
```

## 5. Incident triage

Первый срез:

```bash
date -u
docker compose ps
curl -i http://127.0.0.1:${API_PORT:-3000}/health
curl -i http://127.0.0.1:${API_PORT:-3000}/ready
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:${API_PORT:-3000}/queues/status
docker compose logs --since=30m api
docker compose logs --since=30m worker
docker compose logs --since=30m bot
```

Разделение симптомов:

- `/health` падает: API процесс не стартует, crash loop, порт/прокси, invalid production env.
- `/health` ok, `/ready` 503: смотри компонент `database`, `redis` или `queues` в body.
- Bot молчит, API ok: смотри `bot` logs, Telegram token, сетевые ошибки Telegram, Redis.
- Генерации не завершаются: смотри `worker`, provider timeouts, S3 upload, очередь `cover-generation`.
- Пользователь оплатил, доступа нет: смотри `Payment`, Platega callback, `CreditLedgerEntry`, `UserSubscription`.

Проверка БД из compose:

```bash
docker compose exec postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-covers}"
docker compose exec postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-covers}" -c "select now();"
```

Проверка Redis:

```bash
docker compose exec redis redis-cli ping
docker compose exec redis redis-cli info persistence
docker compose exec redis redis-cli info replication
```

## 6. Queue failures

Очереди мониторятся через `/queues/status` для:

- `cover-generation`;
- `hook-generation`;
- `face-card-generation`.

Смотреть:

- `waiting` - растет ли быстрее, чем worker разбирает;
- `active` - зависшие активные задачи;
- `failed` - всплеск ошибок;
- `oldestJob.ageMs` - возраст самой старой задачи.

Базовая диагностика:

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:${API_PORT:-3000}/queues/status
docker compose logs --since=30m worker
docker compose logs --since=30m api
docker compose exec redis redis-cli --scan --pattern 'bull:*'
```

Типовые причины:

- внешний provider недоступен или отвечает дольше `KIE_*_TIMEOUT_MS`, `OPENROUTER_TIMEOUT_MS`, `SCRAPECREATORS_TIMEOUT_MS`, `DEEPGRAM_TIMEOUT_MS`;
- S3 недоступен или неверны `S3_*`;
- Redis недоступен, ушел в replica mode или volume заполнен;
- worker crash loop из-за env/миграции/несовместимого build;
- задачи падают на конкретном типе входа, например video/transcript/face asset.

Действия:

- если worker crash loop: читать первые ошибки `docker compose logs worker`;
- если provider timeout: снизить входящий поток, проверить статус provider, не перезапускать бесконечно;
- если `waiting` растет, а `active` почти нет: перезапустить worker;
- если `failed` растет только для нового релиза: остановить bot/API intake или откатить app-layer.

## 7. Worker restart

Мягкий restart worker:

```bash
docker compose restart worker
docker compose logs --tail=100 worker
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:${API_PORT:-3000}/queues/status
```

Если restart не помогает:

```bash
docker compose stop worker
docker compose logs --since=30m worker
docker compose up -d worker
```

Перед любым ручным удалением Redis keys или job state нужен snapshot Redis/Postgres и понимание, какие пользователи пострадают. В текущем API нет штатной ручки для replay/clean failed jobs, поэтому лучше сначала диагностировать причину падения, а не чистить очередь.

## 8. Platega callback diagnosis

Callback endpoint:

```text
POST /payments/platega/callback
Headers: x-merchantid, x-secret
```

Что проверить:

- `PLATEGA_MERCHANT_ID` и `PLATEGA_SECRET` совпадают с настройками Platega.
- Platega смотрит на публичный HTTPS URL, который проксирует именно текущий `api`.
- Callback не закрыт admin auth: путь `/payments/platega/callback` публичный, но header auth обязателен.
- В логах API нет `invalid_platega_auth`, `Payment was not found for Platega transaction`, `Payment amount mismatch`, `Payment currency mismatch`.
- В таблице `Payment` есть запись с ожидаемым `providerTransactionId`.

Срез платежей через API:

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:${API_PORT:-3000}/admin/payments
```

Срез платежа через SQL:

```bash
docker compose exec postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-covers}" \
  -c "select id, \"userId\", status, \"amountRub\", currency, \"providerTransactionId\", \"providerStatus\", \"confirmedAt\", \"failedAt\", \"createdAt\" from \"Payment\" order by \"createdAt\" desc limit 20;"
```

Интерпретация:

- `401 invalid_platega_auth` - неверные `x-merchantid`/`x-secret` или production env.
- `Payment was not found...` - callback пришел по transaction id, которого нет в БД; проверить создание pending payment и payload.
- `amount/currency mismatch` - не подтверждать вручную до сверки суммы в Platega и БД.
- `CONFIRMED` должен перевести `Payment.status` в `SUCCEEDED` и выдать кредиты или активировать подписку.
- `REFUNDED`/`CHARGEBACKED` после успешного платежа должен отменить подписку или списать купленные кредиты в пределах текущего баланса.

## 9. Manual credit/subscription recovery

Предпочтительный путь для кредитов - admin API, потому что он пишет `CreditLedgerEntry` и `AuditLog`:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":10,"note":"manual recovery after incident <ticket-id>"}' \
  http://127.0.0.1:${API_PORT:-3000}/admin/users/<user-id>/credits
```

Проверка ledger:

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:${API_PORT:-3000}/admin/users/<user-id>/ledger
```

Перед ручной подпиской через SQL:

- сверить Platega transaction id, сумму и пользователя;
- сделать snapshot БД;
- проверить, нет ли уже активной подписки;
- записать incident/ticket id в операционный журнал.

Пример проверки пользователя и подписок:

```bash
docker compose exec postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-covers}" \
  -c "select id, \"telegramId\", username, balance from \"User\" where \"telegramId\" = <telegram-id>;"

docker compose exec postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-covers}" \
  -c "select id, plan, status, \"currentPeriodStart\", \"currentPeriodEnd\", \"monthlyCreditLimit\", \"usedCredits\", \"sourcePaymentId\" from \"UserSubscription\" where \"userId\" = '<user-id>' order by \"createdAt\" desc;"
```

Ручные SQL updates делай только если штатный callback невозможно восстановить. Для подписок важно не создать две активные подписки одновременно: текущая логика приложения при нормальном callback переводит старые активные подписки в `EXPIRED` и создает новую на 30 дней.

## 10. Env checklist

Production должен иметь `APP_ENV=production` или `NODE_ENV=production`, иначе production env validation не включится.

Обязательные значения для production:

- `ADMIN_TOKEN` - реальный секрет, не `change-me`.
- `BOT_TOKEN`.
- `DATABASE_URL` или корректные `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
- `REDIS_URL`.
- `PLATEGA_BASE_URL`, `PLATEGA_MERCHANT_ID`, `PLATEGA_SECRET`, `PAYMENT_RETURN_URL`.
- `KIE_API_KEY`, `KIE_BASE_URL`, `KIE_IMAGE_MODEL`.
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.
- `SCRAPECREATORS_API_KEY`, `SCRAPECREATORS_BASE_URL`.
- `DEEPGRAM_API_KEY`, `DEEPGRAM_MODEL`.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`.

Операционные значения, которые стоит явно зафиксировать:

- `PUBLIC_API_URL` - публичный URL API для внешних интеграций.
- `KIE_CALLBACK_URL` - если используется provider callback.
- `SUPPORT_CONTACT`, `PRIVACY_POLICY_URL`, `USER_AGREEMENT_URL`.
- `GENERATION_JOB_TIMEOUT_MS`, `HOOK_JOB_TIMEOUT_MS`, `FACE_CARD_JOB_TIMEOUT_MS`.
- `FACE_CARD_WORKER_CONCURRENCY`, `FACE_CARD_WORKER_LIMIT_MAX`, `FACE_CARD_WORKER_LIMIT_DURATION_MS`.

Красные флаги перед стартом:

- пустой `BOT_TOKEN`, `PLATEGA_SECRET`, `S3_SECRET_ACCESS_KEY`;
- `ADMIN_TOKEN=change-me`;
- production смотрит на localhost provider callback URL;
- `PRISMA_DB_SETUP_MODE=push` в production без явного emergency-решения;
- `FREE_GENERATION_MODE=true` в коммерческом production, если бесплатный режим не является осознанным запуском.
