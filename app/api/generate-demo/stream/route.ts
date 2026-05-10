import { NextResponse } from "next/server";
import { z } from "zod";
import { resolve2gisLink } from "@/lib/2gis/resolve2gisLink";
import { analyzeReviews } from "@/lib/ai/analyzeReviews";
import { getDb } from "@/lib/db";
import { optionalEnv } from "@/lib/env";
import { Apify2gisPlaceProvider } from "@/lib/places/Apify2gisPlaceProvider";
import { upsertProjectPlace } from "@/lib/projects/upsertProjectPlace";
import { Apify2gisReviewsProvider } from "@/lib/reviews/Apify2gisReviewsProvider";
import { normalizeDbReview } from "@/lib/reviews/normalizeDbReview";
import { generateSiteContent } from "@/lib/site/generateSiteContent";

const requestSchema = z.object({
  url: z.string().url(),
  limit: z.number().int().min(1).max(500).optional()
});

type ProgressEvent = {
  type: "progress" | "done" | "error";
  step: string;
  title: string;
  message: string;
  data?: unknown;
};

function line(event: ProgressEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  const input = requestSchema.parse(await request.json());
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  async function send(event: ProgressEvent) {
    await writer.write(line(event));
  }

  async function run() {
    try {
      await send({
        type: "progress",
        step: "resolve",
        title: "Разбираем ссылку 2ГИС",
        message: "Проверяем ссылку, раскрываем короткий URL и ищем firmId."
      });
      const resolved = await resolve2gisLink(input.url);

      await send({
        type: "progress",
        step: "place",
        title: "Забираем карточку места",
        message: "Через Apify получаем название, адрес, рейтинг, контакты и координаты.",
        data: { firmId: resolved.firmId }
      });
      const placeProvider = new Apify2gisPlaceProvider();
      const place = await placeProvider.getPlace({
        placeUrl: resolved.resolvedUrl,
        resolved
      });
      const project = await upsertProjectPlace({
        sourceUrl: resolved.resolvedUrl,
        place
      });

      await send({
        type: "progress",
        step: "reviews",
        title: "Собираем отзывы и фотографии",
        message: "Запускаем Apify actor, чистим короткие и повторяющиеся отзывы, сохраняем фото из отзывов.",
        data: { placeName: place.name }
      });
      const reviewsProvider = new Apify2gisReviewsProvider();
      await reviewsProvider.getReviews({
        projectId: project.id,
        placeUrl: resolved.resolvedUrl,
        firmId: resolved.firmId,
        limit: input.limit
      });

      const db = getDb();
      const reviews = await db.review.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: "asc" }
      });
      const normalizedReviews = reviews.map(normalizeDbReview);
      const photoCount = normalizedReviews.reduce((count, review) => count + (review.images?.length ?? 0), 0);

      await send({
        type: "progress",
        step: "analysis",
        title: "Быстро выделяем главное",
        message: "Локальная модель делает короткий анализ: 2-3 причины визита, настроение, частые темы и лучшие цитаты.",
        data: { reviewsCount: reviews.length, photoCount }
      });
      const analysis = await analyzeReviews({ place, reviews: normalizedReviews });

      await send({
        type: "progress",
        step: "site",
        title: "Собираем JSON сайта",
        message: "Генерируем hero, отраслевой блок, CTA и тексты только на основе найденных доказательств.",
        data: {
          style: analysis.styleDna.adjectives.slice(0, 3),
          topics: analysis.popularMentions.slice(0, 3).map((item) => item.label)
        }
      });
      const content = await generateSiteContent({ place, reviews: normalizedReviews, analysis });

      const generatedSite = await db.generatedSite.upsert({
        where: { projectId: project.id },
        update: {
          slug: project.slug,
          analysis,
          content
        },
        create: {
          projectId: project.id,
          slug: project.slug,
          analysis,
          content
        }
      });

      await db.project.update({
        where: { id: project.id },
        data: { status: "SITE_GENERATED" }
      });

      const appUrl = optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/$/, "");

      await send({
        type: "done",
        step: "done",
        title: "Сайт готов",
        message: "Предпросмотр опубликован локально.",
        data: {
          projectId: project.id,
          slug: project.slug,
          reviewsCount: reviews.length,
          photoCount,
          analysis,
          content,
          publicPath: `/s/${generatedSite.slug}`,
          publicUrl: `${appUrl}/s/${generatedSite.slug}`
        }
      });
    } catch (error) {
      await send({
        type: "error",
        step: "error",
        title: "Не удалось создать сайт",
        message: error instanceof Error ? error.message : "Unknown generation error"
      });
    } finally {
      await writer.close();
    }
  }

  void run();

  return new NextResponse(stream.readable, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform"
    }
  });
}
