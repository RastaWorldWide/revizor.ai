# revizor.ai

MVP app that generates one-page websites for local businesses from 2GIS links and reviews.

## Stack

- Next.js 15 App Router
- TypeScript strict mode
- Tailwind CSS
- Prisma + PostgreSQL
- Zod for AI JSON validation
- Apify for 2GIS place cards and reviews
- LM Studio, Ollama, or OpenRouter as an AI provider

## Quick Start

1. Copy `.env.example` to `.env.local`.
2. Fill `DATABASE_URL`, `APIFY_TOKEN`, and AI settings.
3. Apply database migrations:

```bash
npm run prisma:migrate
```

4. Start the dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Environment

The MVP no longer requires the official 2GIS Places API key. It uses Apify as the data provider for both the place card and reviews.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/review_sites"
APIFY_TOKEN="your_apify_token"

AI_PROVIDER="lmstudio"
AI_BASE_URL="http://localhost:1234/v1"
AI_MODEL="qwen3-14b"
AI_ANALYSIS_PROVIDER="lmstudio"
AI_ANALYSIS_MODEL="qwen3-14b"
AI_SITE_PROVIDER="lmstudio"
AI_SITE_MODEL="qwen3-14b"
AI_API_KEY="local"
OPENROUTER_API_KEY=""
OPENROUTER_APP_NAME="revizor.ai"
OPENROUTER_JSON_MODE="auto"
AI_DISABLE_THINKING="true"
AI_MAX_REVIEWS_FOR_ANALYSIS="8"
AI_MAX_REVIEWS_FOR_SITE="5"
AI_REVIEW_MAX_CHARS="220"

NEXT_PUBLIC_ROOT_DOMAIN="localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

If LM Studio returns a context length error, reduce `AI_MAX_REVIEWS_FOR_ANALYSIS` or `AI_REVIEW_MAX_CHARS`, or reload the model with a larger context length.

For better websites, load a stronger model in LM Studio and set its exact model id in `AI_SITE_MODEL`. Keep `AI_ANALYSIS_MODEL` on a faster model if you want the early analysis step to stay quick.

To test models through OpenRouter instead of a local model, switch the AI env values:

```env
AI_PROVIDER="openrouter"
AI_BASE_URL="https://openrouter.ai/api/v1"
OPENROUTER_API_KEY="your_openrouter_key"
AI_MODEL="openai/gpt-4o-mini"
AI_ANALYSIS_MODEL="openai/gpt-4o-mini"
AI_SITE_MODEL="openai/gpt-4o-mini"
```

Use the exact model id from OpenRouter. By default `OPENROUTER_JSON_MODE="auto"` tries strict structured output first, then falls back to simpler JSON modes when a model does not support strict schemas. You can force a mode with `schema`, `json_object`, or `prompt`.

You can also split providers by generation step. For example, keep review analysis local and send website generation to OpenRouter:

```env
AI_PROVIDER="lmstudio"
AI_BASE_URL="http://localhost:1234/v1"
AI_API_KEY="local"
AI_MODEL="qwen/qwen3-14b"

AI_ANALYSIS_PROVIDER="lmstudio"
AI_ANALYSIS_MODEL="qwen/qwen3-14b"

AI_SITE_PROVIDER="openrouter"
AI_SITE_MODEL="openai/gpt-4o-mini"

OPENROUTER_API_KEY="your_openrouter_key"
OPENROUTER_JSON_MODE="auto"
```

## Main Endpoints

- `POST /api/resolve-2gis` with `{ "url": "..." }`
- `POST /api/import-place` with `{ "url": "..." }`
- `POST /api/generate-demo` with `{ "url": "...", "limit": 60 }`
- `POST /api/generate-demo/stream` with `{ "url": "...", "limit": 60 }`

## Public Sites

Generated sites are available at `/s/[slug]`.

The generator creates an industry-specific section when reviews support it: for example dishes and occasions for restaurants, services and masters for salons, trust and process for clinics, or assortment for stores.

Wildcard subdomains are handled in `middleware.ts`:

- `yourdomain.ru` and `app.yourdomain.ru` show the main app
- `{slug}.yourdomain.ru` rewrites to `/s/{slug}`
- `{slug}.localhost:3000` is supported for local development
