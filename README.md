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

Credit monetization remains in the codebase, but the default product mode is
`FREE_GENERATION_MODE=true` while pricing is still being shaped.

## Apps

- `apps/bot` - Telegram bot, wizard, Stars payments.
- `apps/api` - Fastify admin API.
- `apps/admin` - React admin panel.
- `apps/worker` - BullMQ generation worker.

## Packages

- `packages/domain` - shared types and credit rules.
- `packages/db` - Prisma schema and repositories.
- `packages/generation-ai` - Kie.ai image generation and OpenRouter prompt planning.
- `packages/openai-image` - legacy OpenAI Images adapter kept for optional fallback work.
- `packages/storage` - S3-compatible storage adapter.
- `packages/telegram-payments` - Telegram Stars invoice helpers.

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

The MVP uses Telegram Stars for digital goods. Credits are granted only after
`successful_payment`, never after `pre_checkout_query`.

## Required AI Env

```bash
KIE_API_KEY=""
KIE_BASE_URL="https://api.kie.ai"
KIE_IMAGE_MODEL="gpt-image-2-image-to-image"
KIE_POLL_INTERVAL_MS="3000"
KIE_POLL_TIMEOUT_MS="900000"

OPENROUTER_API_KEY=""
OPENROUTER_MODEL="google/gemini-3.1-flash-image-preview"

SCRAPECREATORS_API_KEY=""
SCRAPECREATORS_BASE_URL="https://api.scrapecreators.com"
SCRAPECREATORS_TRANSCRIPT_LANGUAGE=""
SCRAPECREATORS_TIKTOK_AI_FALLBACK="false"

DEEPGRAM_API_KEY=""
DEEPGRAM_MODEL="nova-3"
DEEPGRAM_LANGUAGE=""
```

Kie.ai tasks are asynchronous: the worker creates a task, polls
`/api/v1/jobs/recordInfo`, downloads the result immediately, and stores it in S3.

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
