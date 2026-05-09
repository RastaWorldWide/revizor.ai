export type GetReviewsInput = {
  projectId: string;
  placeUrl: string;
  firmId?: string;
  limit?: number;
};

export type NormalizedReview = {
  externalId?: string;
  authorName?: string;
  rating?: number;
  text: string;
  images?: string[];
  publishedAt?: Date;
  source: "2gis" | "manual" | "unknown";
  raw?: unknown;
};

export interface ReviewsProvider {
  getReviews(input: GetReviewsInput): Promise<NormalizedReview[]>;
}
