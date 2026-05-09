import type { NormalizedPlace } from "@/lib/2gis/types";
import type { NormalizedReview } from "@/lib/reviews/ReviewsProvider";

type ReviewWithOptionalId = NormalizedReview & { id?: string };

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`;
}

export function compactPlaceForPrompt(place: NormalizedPlace) {
  return {
    firmId: place.firmId,
    name: place.name,
    address: place.address,
    fullAddress: place.fullAddress,
    rating: place.rating,
    reviewsCount: place.reviewsCount,
    schedule: place.schedule,
    rubrics: place.rubrics,
    contacts: place.contacts,
    point: place.point
  };
}

export function compactReviewsForPrompt(
  reviews: ReviewWithOptionalId[],
  options?: {
    maxReviews?: number;
    maxTextChars?: number;
  }
) {
  const maxReviews = options?.maxReviews ?? numberEnv("AI_MAX_REVIEWS_FOR_ANALYSIS", 18);
  const maxTextChars = options?.maxTextChars ?? numberEnv("AI_REVIEW_MAX_CHARS", 300);

  return reviews
    .slice()
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, maxReviews)
    .map((review, index) => ({
      id: review.id ?? `review_${index + 1}`,
      rating: review.rating,
      authorName: review.authorName,
      text: truncate(review.text, maxTextChars)
    }));
}
