# TG YouTube Cover Bot

Russian-first Telegram product for monetized AI cover generation.

## Product Flow

The current MVP is focused on one simple user path:

1. User starts the bot and taps `Новый проект`.
2. User provides a source: published video link, uploaded video, or transcript text.
3. User chooses platform: YouTube, Instagram/TikTok, or Faceless.
4. User chooses a thumbnail template from the library.
5. OpenRouter/Gemini generates CTR hook candidates from the project source.
6. User selects one hook.
7. User uploads a visual base/reference for Kie image-to-image generation.
8. OpenRouter/Gemini writes the final generation prompt from source + platform + template + hook + visual reference.
9. Kie.ai creates the image with `gpt-image-2-image-to-image`.
10. The worker downloads the temporary provider result, normalizes it with Sharp, stores it in S3, and sends it back in Telegram.

New users receive 3 trial credits by default. Paid access is subscription-based:
Start has 100 monthly credits, Pro has 500 monthly credits, and Business has
unlimited monthly credits. Unused monthly credits do not roll over.

## Apps

- `apps/bot` - Telegram bot, wizard, Platega checkout handoff.
- `apps/api` - Fastify admin API.
- `apps/admin` - React admin panel.
- `apps/worker` - BullMQ generation worker.

## Packages

- `packages/domain` - shared types and credit rules.
- `packages/db` - Prisma schema and repositories.
- `packages/generation-ai` - Kie.ai image generation and OpenRouter prompt planning.
- `packages/openai-image` - legacy OpenAI Images adapter kept for optional fallback work.
- `packages/storage` - S3-compatible storage adapter.
- `packages/payments` - Platega RUB transaction helpers.

## Local Setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev:api
npm run dev:worker
npm run dev:bot
npm run dev:admin
```

## Docker Setup

Use this path when you do not have local Postgres or Redis installed.

1. Create a Docker env file:

```bash
cp .env.docker.example .env.docker
```

2. Fill the required keys in `.env.docker`:

```bash
APP_ENV="local"
ADMIN_TOKEN="change-me"
API_RATE_LIMIT_PUBLIC_MAX="120"
API_RATE_LIMIT_PUBLIC_WINDOW_MS="60000"
API_RATE_LIMIT_ADMIN_MAX="600"
API_RATE_LIMIT_ADMIN_WINDOW_MS="60000"
API_RATE_LIMIT_REDIS_FAILURE_MODE="fail-open"
BOT_TOKEN=""
BOT_ABUSE_GUARD_MAX="6"
BOT_ABUSE_GUARD_WINDOW_MS="60000"
BOT_ABUSE_GUARD_REDIS_TIMEOUT_MS="1000"
BOT_ABUSE_GUARD_REDIS_FAILURE_MODE="fail-open"
BOT_ABUSE_GUARD_MESSAGE="Слишком много запросов подряд. Подождите {seconds} сек. и попробуйте ещё раз."
BOT_WEBHOOK_URL=""
BOT_WEBHOOK_HOST="0.0.0.0"
BOT_WEBHOOK_PORT="8080"
SUPPORT_CONTACT="@karlo25"
PRIVACY_POLICY_URL="https://telegra.ph/Politika-konfidencialnosti-06-21-31"
USER_AGREEMENT_URL="https://telegra.ph/Polzovatelskoe-soglashenie-04-01-19"
KIE_API_KEY=""
OPENROUTER_API_KEY=""
SCRAPECREATORS_API_KEY=""
DEEPGRAM_API_KEY=""
S3_ENDPOINT=""
S3_BUCKET=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_PUBLIC_BASE_URL=""
```

3. Start the full stack:

```bash
docker compose up --build
```

The stack includes:

- `postgres` on `localhost:5432`
- `redis` on `localhost:6379`
- `api` on `http://localhost:3000`
- `admin` on `http://localhost:5173`
- `worker`
- `bot`

The local Docker example uses `APP_ENV=local`, so empty provider keys remain
convenient while you are wiring services. For any real deployment, set
`APP_ENV=production` and fill the production env listed below.

The API container applies versioned Prisma migrations before starting with
`prisma migrate deploy`. This is the production-safe default and does not use
`prisma db push --accept-data-loss`.

For disposable local Docker databases only, you can opt into schema push:

```bash
PRISMA_DB_SETUP_MODE=push docker compose up --build
```

If that local push needs destructive changes, set
`PRISMA_DB_PUSH_ACCEPT_DATA_LOSS=true` explicitly for that run. Do not use that
flag in production.

If a Postgres volume already exists, changing `POSTGRES_PASSWORD` does not
change the stored database password. In that case set `DATABASE_URL` to the
actual existing database credentials, or recreate the Postgres volume.

Useful commands:

```bash
docker compose ps
docker compose logs -f api worker bot
docker compose down
docker compose down -v
```

Use `docker compose down -v` only when you want to delete local Postgres and
Redis data.

## Admin Security

`ADMIN_TOKEN` is a server-side secret used by the Fastify admin API. The React
admin panel does not embed this token at build time. Open the admin panel, click
`Token`, and paste the current server token; it is stored in browser
`localStorage` for that browser only.

Do not use `VITE_ADMIN_TOKEN`. Frontend build variables are public in the
browser bundle. `VITE_API_URL` is still safe to use because it is only the public
admin API origin.

## Abuse Protection

The API uses Redis-backed fixed-window rate limits. `/health` is intentionally
excluded for uptime probes; public routes such as `/ready` and payment callbacks
use the public limit, while `/admin/*` and `/queues/*` use the admin limit. The
default Redis failure mode is `fail-open`; set
`API_RATE_LIMIT_REDIS_FAILURE_MODE="fail-closed"` if traffic should be rejected
when Redis is unavailable.

```bash
API_RATE_LIMIT_PUBLIC_MAX="120"
API_RATE_LIMIT_PUBLIC_WINDOW_MS="60000"
API_RATE_LIMIT_ADMIN_MAX="600"
API_RATE_LIMIT_ADMIN_WINDOW_MS="60000"
API_RATE_LIMIT_REDIS_FAILURE_MODE="fail-open"
```

The Telegram bot rate-limits expensive actions per Telegram user, falling back
to chat id when user id is unavailable. Normal menu navigation is not limited;
source submission, media uploads, hook generation, and final generation share
the same tunable window but use separate Redis keys per action scope.

```bash
BOT_ABUSE_GUARD_MAX="6"
BOT_ABUSE_GUARD_WINDOW_MS="60000"
BOT_ABUSE_GUARD_REDIS_TIMEOUT_MS="1000"
BOT_ABUSE_GUARD_REDIS_FAILURE_MODE="fail-open"
BOT_ABUSE_GUARD_MESSAGE="Слишком много запросов подряд. Подождите {seconds} сек. и попробуйте ещё раз."
```

## Production Env Validation

On startup, the API validates production env when `APP_ENV=production`, or when
`NODE_ENV=production` and no `APP_ENV`/`DEPLOY_ENV` override is set. Local
examples use `APP_ENV=local` so development remains easy.

Production requires these values to be present:

```bash
APP_ENV="production"
ADMIN_TOKEN="strong-secret-not-change-me"
BOT_TOKEN="..."
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
PLATEGA_BASE_URL="https://app.platega.io/"
PLATEGA_MERCHANT_ID="..."
PLATEGA_SECRET="..."
PAYMENT_RETURN_URL="https://t.me/karpix_oblozhka_bot"
KIE_API_KEY="..."
KIE_BASE_URL="https://api.kie.ai"
KIE_IMAGE_MODEL="gpt-image-2-image-to-image"
OPENROUTER_API_KEY="..."
OPENROUTER_MODEL="google/gemini-3.1-flash-image-preview"
SCRAPECREATORS_API_KEY="..."
SCRAPECREATORS_BASE_URL="https://api.scrapecreators.com"
DEEPGRAM_API_KEY="..."
DEEPGRAM_MODEL="nova-3"
S3_ENDPOINT="..."
S3_REGION="auto"
S3_BUCKET="..."
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_BASE_URL="https://..."
```

Payments use Platega RUB transactions. Credits or subscriptions are granted only
after Platega reports a confirmed transaction, and payment completion is
idempotent so duplicate callbacks do not grant access twice.

Configure these Platega environment variables in production:

```bash
PLATEGA_BASE_URL="https://app.platega.io/"
PLATEGA_MERCHANT_ID="..."
PLATEGA_SECRET="..."
PLATEGA_TIMEOUT_MS="30000"
PAYMENT_RETURN_URL="https://t.me/karpix_oblozhka_bot"
```

In the Platega cabinet, set the transaction status callback URL to:

```text
https://your-api-domain.example/payments/platega/callback
```

## Staging And Load Verification

Use the production smoke script after a staging or production deploy. It checks
the public health/readiness endpoints and the protected queue status endpoint
with `ADMIN_TOKEN`; secrets are never printed.

```bash
API_BASE_URL="https://your-api-domain.example" ADMIN_TOKEN="..." npm run smoke:production
```

Optional Platega callback auth-negative smoke verifies that invalid callback
credentials are rejected before any payment mutation can happen:

```bash
API_BASE_URL="https://your-api-domain.example" ADMIN_TOKEN="..." SMOKE_PLATEGA_CALLBACK=true npm run smoke:production
```

Use the load probe only against cheap GET endpoints. By default it probes
`/health` and `/ready`; paths that look like generation, provider, payment, or
webhook routes are blocked.

```bash
LOAD_BASE_URL="https://your-api-domain.example" LOAD_DURATION_SECONDS=30 LOAD_CONCURRENCY=4 LOAD_RPS=5 npm run load:probe
```

Useful load-probe variables:

```bash
LOAD_ENDPOINTS="/health,/ready"
LOAD_TIMEOUT_MS="5000"
LOAD_MAX_ERROR_RATE="0"
LOAD_MAX_P95_MS=""
```

## Telegram Bot Runtime

By default the bot runs in long polling mode. This is the recommended local
development mode and does not require a public URL.

Set `BOT_WEBHOOK_URL` to switch the bot to webhook mode:

```bash
BOT_WEBHOOK_URL="https://your-domain.example/telegram/webhook"
BOT_WEBHOOK_HOST="0.0.0.0"
BOT_WEBHOOK_PORT="8080"
```

When webhook mode is enabled, the bot sets the Telegram webhook to
`BOT_WEBHOOK_URL` and starts an HTTP listener on `BOT_WEBHOOK_HOST` and
`BOT_WEBHOOK_PORT`. Point your reverse proxy or tunnel at that listener.

## Required AI Env

```bash
KIE_API_KEY=""
KIE_BASE_URL="https://api.kie.ai"
KIE_IMAGE_MODEL="gpt-image-2-image-to-image"
KIE_POLL_INTERVAL_MS="3000"
KIE_POLL_TIMEOUT_MS="900000"
KIE_REQUEST_TIMEOUT_MS="120000"
KIE_DOWNLOAD_TIMEOUT_MS="120000"
REFERENCE_IMAGE_TIMEOUT_MS="30000"
REFERENCE_IMAGE_MAX_BYTES="15728640"

OPENROUTER_API_KEY=""
OPENROUTER_MODEL="google/gemini-3.1-flash-image-preview"
OPENROUTER_TIMEOUT_MS="120000"

SCRAPECREATORS_API_KEY=""
SCRAPECREATORS_BASE_URL="https://api.scrapecreators.com"
SCRAPECREATORS_TRANSCRIPT_LANGUAGE=""
SCRAPECREATORS_TIKTOK_AI_FALLBACK="false"
SCRAPECREATORS_TIMEOUT_MS="60000"

DEEPGRAM_API_KEY=""
DEEPGRAM_MODEL="nova-3"
DEEPGRAM_LANGUAGE=""
DEEPGRAM_TIMEOUT_MS="120000"
```

Kie.ai tasks are asynchronous: the worker creates a task, polls
`/api/v1/jobs/recordInfo`, downloads the result immediately, and stores it in S3.

## Worker Queues And Timeouts

The worker uses separate queues for image generation, hook generation, and
background face-card preparation. User photo uploads store the source image
immediately, enqueue `face-card-generation`, and do not block the Telegram
handler while Kie prepares a reusable face card.

Useful production tuning variables:

```bash
GENERATION_JOB_TIMEOUT_MS="1200000"
HOOK_JOB_TIMEOUT_MS="600000"
FACE_CARD_JOB_TIMEOUT_MS="300000"
GENERATION_WORKER_CONCURRENCY="2"
HOOK_WORKER_CONCURRENCY="4"
FACE_CARD_WORKER_CONCURRENCY="2"
FACE_CARD_WORKER_LIMIT_MAX="2"
FACE_CARD_WORKER_LIMIT_DURATION_MS="10000"
WORKER_LOCK_DURATION_MS="600000"
```

Protected ops endpoints:

- `GET /queues/status` - queue counts and oldest job age.
- `GET /ops/metrics` - process memory/uptime plus queue aggregates.
- `GET /ops/alerts` - `ok/warn/critical` queue threshold report for deploy gates.

Queue alert thresholds are configured with:

```bash
OPS_QUEUE_BACKLOG_WARN="20"
OPS_QUEUE_BACKLOG_CRITICAL="100"
OPS_QUEUE_OLDEST_JOB_WARN_MS="300000"
OPS_QUEUE_OLDEST_JOB_CRITICAL_MS="900000"
OPS_QUEUE_FAILED_WARN="1"
OPS_QUEUE_FAILED_CRITICAL="10"
```

Source ingestion uses this cascade:

1. User-provided transcript is used directly.
2. Published links use ScrapeCreators transcript endpoints for YouTube, TikTok, and Instagram.
3. Uploaded Telegram video URLs use Deepgram Nova-3 transcription.
4. If no transcript is found, the project is marked `SOURCE_FAILED` and the user should paste a transcript manually.

## Project-Centric Data Model

The product now centers on `Project`, not a raw image generation.

- `Project` stores source type, platform, status, selected hook, and selected template.
- `SourceAsset` stores the original link, Telegram video URL/file id, or transcript text.
- `Transcript` stores raw/clean text for hook generation.
- `HookCandidate` stores generated CTR hooks.
- `Template` stores product-facing thumbnail mechanics.
- `Generation` links back to project/template/hook and stores provider output.

This keeps the Telegram bot, future Mini App, admin panel, payments, and workers
on the same backend model.
