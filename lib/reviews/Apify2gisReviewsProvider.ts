import { runApifyActor } from "@/lib/apify/client";
import { getDb } from "@/lib/db";
import type { GetReviewsInput, NormalizedReview, ReviewsProvider } from "./ReviewsProvider";

const actorId = "zen-studio~2gis-reviews-scraper";
const minReviewLength = 20;

function getString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return undefined;
}

function getDate(record: Record<string, unknown>, keys: string[]): Date | undefined {
  const value = getString(record, keys);
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function collectImageUrls(value: unknown, urls: Set<string>): void {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    if (/^https?:\/\//.test(value) && /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(value)) {
      urls.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, urls));
    return;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "src", "href", "image", "photo", "preview", "thumbnail", "full", "original"]) {
      collectImageUrls(record[key], urls);
    }
  }
}

function getImages(record: Record<string, unknown>): string[] {
  const urls = new Set<string>();

  for (const key of ["images", "photos", "pictures", "media", "attachments", "reviewImages", "reviewPhotos"]) {
    collectImageUrls(record[key], urls);
  }

  return Array.from(urls).slice(0, 6);
}

function normalizeItem(item: unknown): NormalizedReview | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const text = getString(record, ["text", "reviewText", "comment", "content", "description"]);

  if (!text || text.length < minReviewLength) {
    return null;
  }

  return {
    externalId: getString(record, ["id", "reviewId", "externalId"]),
    authorName: getString(record, ["authorName", "userName", "name", "author"]),
    rating: getNumber(record, ["rating", "stars", "score"]),
    text,
    images: getImages(record),
    publishedAt: getDate(record, ["date", "publishedAt", "createdAt"]),
    source: "2gis",
    raw: item
  };
}

function dedupeByText(reviews: NormalizedReview[]): NormalizedReview[] {
  const seen = new Set<string>();

  return reviews.filter((review) => {
    const key = review.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export class Apify2gisReviewsProvider implements ReviewsProvider {
  async getReviews(input: GetReviewsInput): Promise<NormalizedReview[]> {
    const items = await runApifyActor<unknown>(actorId, {
        startUrls: [{ url: input.placeUrl }],
        maxReviews: input.limit
    });
    const reviews = dedupeByText(items.map(normalizeItem).filter((review): review is NormalizedReview => Boolean(review)));

    const db = getDb();

    await Promise.all(
      reviews.map((review) =>
        db.review.upsert({
          where: {
            projectId_text: {
              projectId: input.projectId,
              text: review.text
            }
          },
          create: {
            projectId: input.projectId,
            externalId: review.externalId,
            authorName: review.authorName,
            rating: review.rating,
            text: review.text,
            images: review.images ?? [],
            publishedAt: review.publishedAt,
            source: review.source,
            raw: review.raw ?? undefined
          },
          update: {
            externalId: review.externalId,
            authorName: review.authorName,
            rating: review.rating,
            images: review.images ?? [],
            publishedAt: review.publishedAt,
            raw: review.raw ?? undefined
          }
        })
      )
    );

    await db.project.update({
      where: { id: input.projectId },
      data: { status: "REVIEWS_IMPORTED" }
    });

    return reviews;
  }
}
