# revizor.ai

MVP app that generates one-page websites for local businesses from 2GIS links and reviews.

## Stack

- Next.js 15 App Router
- TypeScript strict mode
- Tailwind CSS
- Prisma + PostgreSQL
- Zod for AI JSON validation
- Apify for 2GIS place cards and reviews
- LM Studio or Ollama as a local AI provider

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
AI_API_KEY="local"
AI_MAX_REVIEWS_FOR_ANALYSIS="18"
AI_MAX_REVIEWS_FOR_SITE="8"
AI_REVIEW_MAX_CHARS="300"

NEXT_PUBLIC_ROOT_DOMAIN="localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

If LM Studio returns a context length error, reduce `AI_MAX_REVIEWS_FOR_ANALYSIS` or `AI_REVIEW_MAX_CHARS`, or reload the model with a larger context length.

## Main Endpoints

- `POST /api/resolve-2gis` with `{ "url": "..." }`
- `POST /api/import-place` with `{ "url": "..." }`
- `POST /api/generate-demo` with `{ "url": "...", "limit": 150 }`

## Public Sites

Generated sites are available at `/s/[slug]`.

Wildcard subdomains are handled in `middleware.ts`:

- `yourdomain.ru` and `app.yourdomain.ru` show the main app
- `{slug}.yourdomain.ru` rewrites to `/s/{slug}`
- `{slug}.localhost:3000` is supported for local development
