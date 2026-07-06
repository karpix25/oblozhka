# Backup and restore checklist

Цель: иметь понятный план восстановления Postgres, S3-compatible storage и Redis для production/beta. Здесь нет ложной гарантии, что один backup покрывает все: база, файлы в S3 и Redis очереди имеют разную критичность и разный способ восстановления.

## 1. Что является источником правды

Postgres - главный источник правды:

- пользователи, балансы и ledger;
- платежи Platega;
- подписки;
- проекты, генерации, статусы;
- ссылки на S3-объекты.

S3-compatible storage - источник медиа-объектов:

- загруженные фото/референсы;
- face cards;
- preview/original generated images;
- файлы, на которые ссылаются поля `imageUrl`, `previewUrl`, `originalUrl`, `referenceImageUrl` и похожие URL в БД.

Redis - операционная очередь BullMQ:

- waiting/active/delayed/failed jobs;
- временное состояние обработки;
- не должен быть единственным источником платежей, балансов или завершенных генераций.

## 2. RPO/RTO guidance

Рекомендации для beta:

- RPO Postgres: до 24 часов, если пользовательские платежи редкие и есть ручная сверка Platega.
- RTO: 2-4 часа на ручное восстановление.
- Restore drill: минимум перед первым beta-запуском и после крупных миграций.

Рекомендации для production:

- RPO Postgres: 15-60 минут через managed backups/WAL/PITR, если платные пользователи активны.
- RPO S3: 24 часа или versioning/replication, если потеря изображений недопустима.
- RTO: до 1 часа для API/bot, отдельно оценивать время requeue/перегенерации зависших задач.
- Restore drill: ежемесячно или перед релизами с рискованными миграциями.

Фактические RPO/RTO зависят от хостинга. Зафиксируй их в ops-журнале после выбора provider.

## 3. Postgres backup

Разовый logical backup через compose:

```bash
mkdir -p backups/postgres
docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-postgres}" \
  -d "${POSTGRES_DB:-covers}" \
  --format=custom \
  --no-owner \
  --no-acl \
  > backups/postgres/covers-$(date -u +%Y%m%dT%H%M%SZ).dump
```

Проверить, что backup не пустой:

```bash
ls -lh backups/postgres/*.dump
pg_restore --list backups/postgres/<backup-file>.dump | head
```

Если `pg_restore` не установлен на host, проверяй внутри контейнера или на машине администратора с PostgreSQL client tools.

Для production лучше использовать managed backup/PITR provider-а. `pg_dump` полезен как portable backup перед релизом, но для большой БД может быть медленным.

## 4. Postgres restore

Восстановление в новую пустую БД предпочтительнее, чем поверх живой.

Минимальный restore drill в локальный compose:

```bash
docker compose stop api worker bot admin
docker compose up -d postgres
docker compose exec postgres createdb -U "${POSTGRES_USER:-postgres}" covers_restore
cat backups/postgres/<backup-file>.dump | docker compose exec -T postgres pg_restore \
  -U "${POSTGRES_USER:-postgres}" \
  -d covers_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl
```

Проверки восстановленной БД:

```bash
docker compose exec postgres psql -U "${POSTGRES_USER:-postgres}" -d covers_restore \
  -c 'select count(*) as users from "User";'

docker compose exec postgres psql -U "${POSTGRES_USER:-postgres}" -d covers_restore \
  -c 'select status, count(*) from "Payment" group by status order by status;'

docker compose exec postgres psql -U "${POSTGRES_USER:-postgres}" -d covers_restore \
  -c 'select status, count(*) from "Generation" group by status order by status;'
```

Production restore порядок:

- объявить freeze на deploy и платежные операции;
- остановить app-слой (`api`, `worker`, `bot`, `admin`);
- снять аварийный snapshot текущего состояния;
- восстановить backup в новую БД или новый managed instance;
- применить нужный release build и migrations, если backup старее текущего кода;
- переключить `DATABASE_URL`;
- поднять `api`, затем проверить `/ready`;
- поднять `worker`, `bot`, `admin`;
- сверить пользователей, платежи, подписки и последние генерации.

Не запускай `prisma db push --accept-data-loss` на восстановленной production БД без отдельного решения: это может уничтожить данные, которые backup как раз должен сохранить.

## 5. S3 backup assumptions

Код пишет объекты в bucket из `S3_BUCKET` и строит публичные URL через `S3_PUBLIC_BASE_URL` или `s3://bucket/key`. В репозитории нет отдельного скрипта backup S3, поэтому политика зависит от provider-а.

Минимальные требования:

- включить bucket versioning, если provider поддерживает;
- включить lifecycle/retention так, чтобы объекты не удалялись раньше бизнес-RPO;
- настроить cross-region или external copy для production;
- хранить credentials вне git;
- периодически проверять, что URL из БД реально открываются через `S3_PUBLIC_BASE_URL`.

Пример sync через AWS CLI для S3-compatible provider:

```bash
aws --endpoint-url "$S3_ENDPOINT" s3 sync \
  "s3://$S3_BUCKET" \
  "backups/s3/$S3_BUCKET/$(date -u +%Y%m%dT%H%M%SZ)" \
  --only-show-errors
```

Для restore в новый bucket:

```bash
aws --endpoint-url "$S3_ENDPOINT" s3 sync \
  "backups/s3/$S3_BUCKET/<snapshot-dir>" \
  "s3://$S3_BUCKET" \
  --only-show-errors
```

Если меняется bucket или public base URL, нужно либо сохранить старые URL доступными, либо мигрировать URL в Postgres. Не делай массовую замену URL без dry-run и backup.

## 6. Redis persistence considerations

В `docker-compose.yml` Redis запускается с AOF:

```text
redis-server --appendonly yes
```

Volume `redis-data` сохраняет AOF между restart. Это помогает пережить обычный restart контейнера, но не заменяет Postgres/S3 backup.

Что важно:

- Redis содержит очередь BullMQ; потеря Redis может потерять waiting/delayed/failed jobs.
- Успешные платежи, балансы и завершенные генерации должны восстанавливаться из Postgres.
- После restore Postgres на более старую точку Redis может содержать jobs, которые ссылаются на уже несуществующие записи. В таком случае безопаснее стартовать с чистого Redis и вручную requeue нужные операции, чем запускать несовместимые jobs.
- Если Redis ушел в replica mode, compose command пытается выполнить `replicaof no one`; проверяй `redis-cli info replication`.

Backup Redis volume имеет смысл перед аварийными операциями с очередью:

```bash
docker compose stop redis
docker run --rm \
  -v hookcover_redis-data:/data \
  -v "$PWD/backups/redis:/backup" \
  alpine tar czf /backup/redis-$(date -u +%Y%m%dT%H%M%SZ).tgz -C /data .
docker compose up -d redis
```

Название volume может отличаться, если compose project name не `hookcover`. Проверь через:

```bash
docker volume ls | grep redis
```

## 7. Restore drill checklist

Проводить drill не на живом production.

- [ ] Выбрать backup Postgres и S3 snapshot.
- [ ] Поднять отдельный compose/project name или отдельный host.
- [ ] Восстановить Postgres backup в пустую БД.
- [ ] Настроить `.env.docker` на restored DB, test Redis и test S3/public base URL.
- [ ] Запустить `api` и проверить `/health`, `/ready`.
- [ ] Запустить `admin`, открыть последние пользователи/платежи/генерации.
- [ ] Проверить несколько S3 URL из БД.
- [ ] Запустить `worker` только после проверки очередей и совместимости Redis.
- [ ] Не подключать production `BOT_TOKEN` в drill; использовать test bot token или оставить bot выключенным.
- [ ] Зафиксировать фактическое время restore и найденные ручные шаги.

Полезные SQL проверки:

```bash
select count(*) from "User";
select status, count(*) from "Payment" group by status;
select status, count(*) from "Generation" group by status;
select status, count(*) from "Project" group by status;
select count(*) from "CreditLedgerEntry";
select count(*) from "UserSubscription";
```

## 8. Recovery after partial outage

Если падал только worker:

- Postgres/S3 обычно не требуют restore.
- Проверить `/queues/status` и worker logs.
- Перезапустить worker.
- Сверить `Generation.status` со статусами очереди.

Если падал только S3:

- Не подтверждать успешными генерации, у которых upload не завершился.
- Проверить `Generation.errorMessage`, `previewUrl`, `originalUrl`.
- После восстановления S3 перезапустить worker и проверить новые uploads.

Если потерян Redis:

- Не считать это автоматической потерей платежей.
- Проверить pending/processing генерации в Postgres.
- Решить, какие операции можно безопасно попросить пользователя повторить, а какие нужно вручную компенсировать кредитами.

Если потерян Postgres:

- Остановить app-слой.
- Восстановить Postgres из backup/PITR.
- Сверить Platega по платежам после RPO-точки.
- Вручную восстановить недостающие подтвержденные платежи через callback replay или операционную процедуру.
