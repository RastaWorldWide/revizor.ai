import type { Review } from "@prisma/client";
import type { NormalizedReview } from "./ReviewsProvider";

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.startsWith("http"));
}

export function normalizeDbReview(review: Review): NormalizedReview & { id: string } {
  return {
    id: review.id,
    externalId: review.externalId ?? undefined,
    authorName: review.authorName ?? undefined,
    rating: review.rating ?? undefined,
    text: review.text,
    images: jsonStringArray(review.images),
    publishedAt: review.publishedAt ?? undefined,
    source: "2gis",
    raw: review.raw ?? undefined
  };
}
