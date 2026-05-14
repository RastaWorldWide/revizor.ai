# revizor.ai

revizor.ai превращает карточку бизнеса из 2ГИС и реальные отзывы клиентов в одностраничный сайт.

Идея продукта: не просто “сделать сайт”, а собрать страницу, которая говорит языком гостей: за что место любят, какие темы повторяются в отзывах, какое настроение у бренда и какие цитаты можно безопасно использовать.

## Что уже умеет MVP

- принимает обычные и короткие ссылки 2ГИС;
- раскрывает ссылку и извлекает `firmId`;
- получает карточку места и отзывы через Apify, без официального 2GIS API key;
- сохраняет проекты, места, отзывы, фото из отзывов и сгенерированные сайты в PostgreSQL;
- анализирует отзывы локальной моделью или OpenRouter;
- генерирует JSON сайта с Zod-валидацией;
- делает дополнительный fallback, если AI-генерация сайта упала;
- показывает пользователю живой прогресс генерации;
- рендерит публичный сайт по `/s/[slug]`;
- поддерживает wildcard subdomains через `middleware.ts`;
- умеет отдавать статический HTML сайта через API download endpoint.

## Стек

- Next.js 15 App Router
- TypeScript strict mode
- Tailwind CSS
- Prisma
- PostgreSQL
- Zod
- Apify
- LM Studio / Ollama / OpenRouter
- Docker Compose для локальной базы

## Быстрый запуск

1. Установить зависимости:

```bash
npm install
```

2. Запустить PostgreSQL:

```bash
docker compose up -d
```

3. Создать `.env` или `.env.local` по примеру `.env.example`.

4. Применить миграции:

```bash
npm run prisma:migrate
```

5. Запустить проект:

```bash
npm run dev
```

6. Открыть:

```text
http://localhost:3000
```

Если порт `3000` занят, Next.js запустится на `3001`. В таком случае открой `http://localhost:3001`.

## Переменные окружения

Минимальный локальный вариант с LM Studio:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/review_sites"
APIFY_TOKEN="your_apify_token"

AI_PROVIDER="lmstudio"
AI_BASE_URL="http://localhost:1234/v1"
AI_API_KEY="local"
AI_MODEL="qwen/qwen3-14b"

AI_ANALYSIS_PROVIDER="lmstudio"
AI_ANALYSIS_MODEL="qwen/qwen3-14b"

AI_SITE_PROVIDER="lmstudio"
AI_SITE_MODEL="qwen/qwen3-14b"

AI_DISABLE_THINKING="true"
AI_MAX_REVIEWS_FOR_ANALYSIS="8"
AI_MAX_REVIEWS_FOR_SITE="5"
AI_REVIEW_MAX_CHARS="220"
AI_SITE_GENERATION_TIMEOUT_MS="25000"
AI_SITE_FALLBACK_ON_ERROR="true"

NEXT_PUBLIC_ROOT_DOMAIN="localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Для более качественных сайтов можно оставить анализ на быстрой модели, а генерацию сайта отдать более сильной:

```env
AI_ANALYSIS_MODEL="qwen/qwen3-14b"
AI_SITE_MODEL="qwen/qwen3-30b-a3b-2507"
```

## OpenRouter

Можно использовать OpenRouter вместо локальной модели:

```env
AI_PROVIDER="openrouter"
AI_BASE_URL="https://openrouter.ai/api/v1"
OPENROUTER_API_KEY="your_openrouter_key"
AI_MODEL="openai/gpt-4o-mini"

AI_ANALYSIS_PROVIDER="openrouter"
AI_ANALYSIS_MODEL="openai/gpt-4o-mini"

AI_SITE_PROVIDER="openrouter"
AI_SITE_MODEL="openai/gpt-4o-mini"
```

Также поддерживается автоматический выбор бесплатной модели:

```env
AI_SITE_PROVIDER="openrouter"
AI_SITE_MODEL="auto-free"
OPENROUTER_FREE_MODELS_URL="https://shir-man.com/api/free-llm/top-models"
OPENROUTER_FREE_MODEL_FALLBACK="openrouter/free"
OPENROUTER_MAX_AUTO_FREE_MODELS="2"
```

Если верхняя бесплатная модель недоступна, приложение пробует следующую. Если сайт всё равно не сгенерировался, включается локальный fallback из анализа отзывов.

## Где взять ссылку на карточку 2ГИС

Для генерации сайта нужна ссылка именно на карточку организации в 2ГИС. Подходит короткая ссылка вида `https://go.2gis.com/...` или обычная ссылка `https://2gis.ru/.../firm/...`.

1. Откройте нужную организацию на сайте 2ГИС.
2. В левой панели карточки нажмите кнопку **Отправить**.

![Где нажать кнопку Отправить в карточке 2ГИС](docs/images/2gis-share-button.jpg)

3. В открывшемся окне **Отправить ссылку** найдите блок **Скопировать ссылку**.
4. Нажмите **Скопировать**.

![Где скопировать короткую ссылку 2ГИС](docs/images/2gis-copy-link-dialog.jpg)

5. Вставьте полученную ссылку в поле на главной странице revizor.ai.

Пример подходящей ссылки:

```text
https://go.2gis.com/wLUaE
```

Важно: не копируйте ссылку из адресной строки браузера, если карточка ещё не открыта полностью. Надёжнее использовать кнопку **Отправить** внутри карточки организации.

## Основные сценарии

### 1. Проверить ссылку 2ГИС

```http
POST /api/resolve-2gis
Content-Type: application/json

{
  "url": "https://go.2gis.com/..."
}
```

### 2. Импортировать карточку места

```http
POST /api/import-place
Content-Type: application/json

{
  "url": "https://2gis.ru/..."
}
```

### 3. Сгенерировать сайт

```http
POST /api/generate-demo
Content-Type: application/json

{
  "url": "https://2gis.ru/...",
  "limit": 60
}
```

### 4. Сгенерировать сайт с живым прогрессом

```http
POST /api/generate-demo/stream
Content-Type: application/json

{
  "url": "https://2gis.ru/...",
  "limit": 60
}
```

Главная страница использует именно streaming endpoint, чтобы пользователь видел этапы:

```text
Ссылка -> Карточка -> Отзывы -> Анализ -> Сайт -> Готово
```

## Публичные сайты

Сгенерированный сайт доступен по:

```text
/s/[slug]
```

Пример:

```text
http://localhost:3000/s/kafe-romashka-12345
```

Wildcard subdomains:

- `yourdomain.ru` и `app.yourdomain.ru` открывают основное приложение;
- `{slug}.yourdomain.ru` переписывается на `/s/{slug}`;
- `{slug}.localhost:3000` поддерживается для локальной разработки.

## Структура проекта

```text
app/
  api/
    generate-demo/
    import-place/
    resolve-2gis/
    sites/
  s/[slug]/
lib/
  2gis/
  ai/
  apify/
  places/
  projects/
  reviews/
  site/
prisma/
  schema.prisma
  migrations/
```

Ключевые модули:

- `lib/2gis/resolve2gisLink.ts` - нормализация 2ГИС-ссылок;
- `lib/places/Apify2gisPlaceProvider.ts` - карточка места через Apify;
- `lib/reviews/Apify2gisReviewsProvider.ts` - отзывы и фото из отзывов;
- `lib/ai/analyzeReviews.ts` - анализ отзывов;
- `lib/site/generateSiteContent.ts` - генерация JSON сайта;
- `lib/site/fallbackSiteContent.ts` - fallback сайт без второго AI-прохода;
- `lib/site/exportSiteHtml.ts` - экспорт публичного сайта в HTML;
- `app/s/[slug]/page.tsx` - публичный renderer.

## База данных

Основные таблицы:

- `Project` - проект генерации;
- `Place` - карточка места;
- `Review` - нормализованные отзывы и изображения;
- `GeneratedSite` - результат анализа и JSON сайта.

Подключение к локальной базе:

```text
Host: localhost
Port: 5432
Database: review_sites
Username: postgres
Password: postgres
```

## Проверки перед push

```bash
npm run typecheck
npm run lint
npm run build
```

## Частые проблемы

### LM Studio: context length error

Уменьши:

```env
AI_MAX_REVIEWS_FOR_ANALYSIS="6"
AI_MAX_REVIEWS_FOR_SITE="4"
AI_REVIEW_MAX_CHARS="180"
```

Или перезагрузи модель в LM Studio с большим context length.

### Порт 3000 занят

Next.js сам выберет следующий порт, например `3001`. Либо останови старый процесс:

```powershell
Stop-Process -Id <PID> -Force
```

### Prisma не видит DATABASE_URL

Prisma CLI читает `.env`. Если используешь только `.env.local`, создай `.env` с:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/review_sites"
```
