# Load test plan

План нужен для beta/production readiness. Он не заменяет реальные лимиты provider-ов: KIE/OpenRouter/ScrapeCreators/Deepgram/Telegram/Platega могут стать bottleneck раньше CPU или Postgres.

## 1. Цели

- Проверить, что API, bot, worker, Postgres, Redis и S3 выдерживают ожидаемый поток.
- Отделить проблемы инфраструктуры от лимитов внешних provider-ов.
- Зафиксировать beta gates и production gates перед запуском.
- Получить baseline метрик: latency, queue age, error rate, successful generation time.

## 2. Что тестируем

Основные пользовательские сценарии:

- новый пользователь открывает bot и проходит onboarding;
- пользователь отправляет ссылку/текст/видео, получает hooks;
- пользователь выбирает hook/template и ставит генерацию в очередь;
- worker обрабатывает `hook-generation`, `cover-generation`, `face-card-generation`;
- пользователь загружает face asset, создается face card;
- пользователь покупает пакет/подписку, Platega callback обновляет доступ;
- admin смотрит пользователей, платежи, генерации и очереди.

Сервисные сценарии:

- `/health` и `/ready` под постоянным polling;
- `/queues/status` под admin polling;
- restart worker во время накопленной очереди;
- provider timeout/error spike;
- Redis restart с AOF;
- Postgres backup во время обычной нагрузки.

## 3. Тестовые окружения

Beta-like:

- отдельный Telegram bot token;
- отдельный Platega test/sandbox merchant, если доступен;
- отдельный S3 bucket/prefix;
- отдельная БД и Redis volume;
- provider keys с лимитами, которые не бьют production.

Production-like:

- same-size или минимум realistic-size instance;
- реальные timeout/concurrency env;
- сеть и reverse proxy как в production;
- без подключения production bot token, если тест может спамить пользователей.

Нельзя проводить разрушительный load test на живом production без freeze, лимитов и rollback-плана.

## 4. Метрики

API:

- p50/p95/p99 latency `/health`, `/ready`, admin endpoints;
- HTTP 5xx/4xx rate;
- Fastify errors in logs;
- readiness component latency: `database`, `redis`, `queues`.

Очереди:

- `waiting`, `active`, `delayed`, `failed`;
- `oldestJob.ageMs`;
- throughput jobs/min per queue;
- retry/failure причины в worker logs.

Worker:

- generation duration by provider;
- timeout rate;
- S3 upload duration/error rate;
- memory/CPU;
- restart count.

Postgres:

- connection count;
- slow queries;
- locks;
- CPU/IO;
- backup duration.

Redis:

- memory usage;
- AOF rewrite status;
- command latency;
- evicted keys should be zero;
- replication role is master.

Business metrics:

- successful generation rate;
- median and p95 time from user action to final image;
- payment callback success rate;
- manual recovery count;
- credit ledger mismatch count should be zero.

## 5. Baseline commands

Health and readiness polling:

```bash
watch -n 2 "curl -sS http://127.0.0.1:${API_PORT:-3000}/ready"
```

Queue status:

```bash
watch -n 5 "curl -sS -H 'Authorization: Bearer $ADMIN_TOKEN' http://127.0.0.1:${API_PORT:-3000}/queues/status"
```

Service resources:

```bash
docker stats
docker compose ps
docker compose logs --tail=100 worker
```

Postgres:

```bash
docker compose exec postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-covers}" \
  -c "select count(*) from pg_stat_activity;"
```

Redis:

```bash
docker compose exec redis redis-cli info memory
docker compose exec redis redis-cli info persistence
docker compose exec redis redis-cli info commandstats
```

## 6. Scenarios

### Scenario A: API/readiness soak

Load:

- 10 minutes at beta: 1-3 RPS to `/health`, `/ready`, `/queues/status`.
- 30-60 minutes at production: expected monitoring rate x2.

Pass:

- `/health` p95 < 100 ms in local network.
- `/ready` p95 < 500 ms without provider calls.
- 0 unexpected 5xx.
- No Redis/Postgres component flap in `/ready`.

### Scenario B: Admin browsing

Load:

- repeated calls to `/admin/users`, `/admin/payments`, `/admin/generations` with valid `ADMIN_TOKEN`;
- 1-3 concurrent admin sessions for beta;
- 5-10 concurrent admin sessions for production, if that is realistic for ops.

Pass:

- p95 < 1 s for list endpoints on expected dataset;
- no DB connection saturation;
- no leaked `ADMIN_TOKEN` in logs.

### Scenario C: Hook generation intake

Load:

- enqueue projects from text/transcript/link inputs;
- start beta with 5-10 users over 15 minutes;
- production gate should test at least expected launch burst x2.

Watch:

- `hook-generation.waiting`;
- OpenRouter/ScrapeCreators/Deepgram timeout logs;
- project statuses `HOOKS_PENDING`, `HOOKS_READY`, `SOURCE_FAILED`.

Pass beta:

- p95 hook-ready time < 2 minutes for text/transcript inputs;
- failed rate < 5% excluding intentional bad URLs/provider sandbox issues;
- oldest hook job < 5 minutes after intake stops.

Pass production:

- p95 hook-ready time < 1 minute for text/transcript inputs under target load;
- failed rate < 2% excluding provider-wide outage;
- queue drains to near zero within 10 minutes after burst.

### Scenario D: Cover generation queue

Load:

- enqueue cover generations with library templates;
- include YouTube and vertical formats;
- include reference modes `NONE`, `REFERENCE`, `FACE` if available in test data.

Watch:

- `cover-generation.waiting/active/failed`;
- KIE timeout/download timeout;
- S3 upload failures;
- `Generation.status`, `previewUrl`, `originalUrl`, `errorMessage`.

Pass beta:

- p95 end-to-end generation < 15 minutes, unless provider SLA is slower;
- failed rate < 10% on valid inputs;
- failed jobs contain actionable error messages.

Pass production:

- p95 end-to-end generation < 8 minutes under target load, or documented provider SLA if slower;
- failed rate < 5% on valid inputs;
- no credit loss on failed generation; refunds/ledger behavior must match billing tests.

### Scenario E: Face card generation

Load:

- upload face assets for 5-20 test users;
- test concurrent uploads near `FACE_CARD_WORKER_CONCURRENCY`.

Watch:

- `face-card-generation.waiting/failed`;
- `FACE_CARD_WORKER_LIMIT_MAX` and `FACE_CARD_WORKER_LIMIT_DURATION_MS`;
- S3 uploads;
- user-visible face gallery state.

Pass beta:

- p95 face card ready < 5 minutes;
- no stuck assets in `ANALYZING`/failed-equivalent state without user-facing recovery.

Pass production:

- p95 face card ready < 3 minutes under target concurrency;
- queue drains after burst without manual Redis cleanup.

### Scenario F: Platega callback burst

Use sandbox/test merchant if available. If not, do not fake successful production payments; test on low-value internal package only after approval.

Load:

- repeated callbacks for existing pending payments;
- duplicate callback delivery;
- non-success statuses `FAILED`, `CANCELED`, `REFUNDED`, `CHARGEBACKED`.

Watch:

- HTTP status from `/payments/platega/callback`;
- `Payment.status`;
- `CreditLedgerEntry`;
- `UserSubscription`;
- API errors about auth, missing payment, amount mismatch.

Pass:

- duplicate `CONFIRMED` is idempotent;
- bad headers return 401;
- amount/currency mismatch does not grant access;
- reversal cancels subscription or reverses purchased credits according to current code.

### Scenario G: Worker restart under load

Load:

- build queue with several active/waiting generation jobs;
- restart worker once.

Commands:

```bash
docker compose restart worker
docker compose logs --tail=100 worker
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:${API_PORT:-3000}/queues/status
```

Pass:

- worker comes back healthy;
- `waiting`/`active` continue moving;
- no permanent queue stall;
- no duplicate user credit charge for the same generation.

## 7. Gates

Beta gate:

- `/ready` stable for 30 minutes during test.
- No container restart loop.
- Payment callback success path tested at least once.
- Admin manual credit adjustment tested on test user.
- Queue oldest job returns below 5 minutes after burst stops.
- No known data-loss issue in Postgres/S3.
- Backup and restore drill completed once on non-production environment.

Production gate:

- `/ready` stable for 2 hours under expected monitoring and background load.
- Launch burst x2 does not push queue oldest job above agreed SLA.
- Worker restart under load passes.
- Platega duplicate callback and reversal paths pass.
- p95 user-visible successful generation time is within published expectation.
- Failed generation rate on valid inputs stays below 5%, or the remaining failures are provider-wide and user-facing copy is acceptable.
- Postgres PITR/backup is enabled and restore drill is documented.
- S3 backup/versioning policy is enabled or business accepts media-loss risk in writing.
- Redis persistence is verified, and recovery plan for lost queue state is accepted.

## 8. Stop conditions

Stop the test immediately if:

- production users are receiving test messages;
- real paid users are charged unintentionally;
- `failed` queues grow continuously for valid inputs;
- Redis memory approaches configured limit or evictions appear;
- Postgres CPU/IO saturation causes `/ready` flapping;
- provider starts rate-limiting or threatening key suspension;
- S3 errors affect existing production media.

## 9. Reporting template

Record after each run:

```text
Date/time UTC:
Environment:
Git commit/image tag:
Config highlights:
Load shape:
Peak users/RPS/jobs:
API p95/p99:
Queue max waiting:
Queue max oldestJob.ageMs:
Generation p50/p95:
Failed jobs count and top reasons:
Payment callback result:
Worker restart result:
Postgres/Redis/S3 notes:
Gate result:
Follow-ups:
```
