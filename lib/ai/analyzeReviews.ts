import { z } from "zod";
import { getAiProvider } from "./getAiProvider";
import type { NormalizedPlace } from "@/lib/2gis/types";
import type { NormalizedReview } from "@/lib/reviews/ReviewsProvider";
import { compactPlaceForPrompt, compactReviewsForPrompt } from "./promptInputs";

const evidenceClaimSchema = z.object({
  title: z.string().max(80),
  description: z.string().max(180),
  evidenceReviewIds: z.array(z.string()).min(1).max(3)
});

export const reviewAnalysisSchema = z.object({
  businessType: z.string(),
  audience: z.array(evidenceClaimSchema).max(2),
  emotionalProfile: z.array(evidenceClaimSchema).max(3),
  styleDna: z.object({
    tone: z.string().max(80),
    adjectives: z.array(z.string().max(30)).max(4),
    colors: z.array(z.string().max(30)).max(4),
    typography: z.string().max(80)
  }),
  mainReasonsToVisit: z.array(evidenceClaimSchema).max(3),
  popularMentions: z.array(
    z.object({
      label: z.string().max(60),
      countEstimate: z.number().int().nonnegative(),
      evidenceReviewIds: z.array(z.string()).min(1).max(3)
    })
  ).max(5),
  serviceHighlights: z.array(evidenceClaimSchema).max(3),
  atmosphereHighlights: z.array(evidenceClaimSchema).max(3),
  customerTips: z.array(evidenceClaimSchema).max(3),
  warnings: z.array(evidenceClaimSchema).max(2),
  bestQuotes: z.array(
    z.object({
      text: z.string().max(160),
      authorName: z.string().max(80).optional(),
      evidenceReviewIds: z.array(z.string()).min(1).max(2)
    })
  ).max(3)
});

export type ReviewAnalysis = z.infer<typeof reviewAnalysisSchema>;

export const reviewAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessType",
    "audience",
    "emotionalProfile",
    "styleDna",
    "mainReasonsToVisit",
    "popularMentions",
    "serviceHighlights",
    "atmosphereHighlights",
    "customerTips",
    "warnings",
    "bestQuotes"
  ],
  properties: {
    businessType: { type: "string" },
    audience: { type: "array", maxItems: 2, items: { $ref: "#/$defs/evidenceClaim" } },
    emotionalProfile: { type: "array", maxItems: 3, items: { $ref: "#/$defs/evidenceClaim" } },
    styleDna: {
      type: "object",
      additionalProperties: false,
      required: ["tone", "adjectives", "colors", "typography"],
      properties: {
        tone: { type: "string", maxLength: 80 },
        adjectives: { type: "array", maxItems: 4, items: { type: "string", maxLength: 30 } },
        colors: { type: "array", maxItems: 4, items: { type: "string", maxLength: 30 } },
        typography: { type: "string", maxLength: 80 }
      }
    },
    mainReasonsToVisit: { type: "array", maxItems: 3, items: { $ref: "#/$defs/evidenceClaim" } },
    popularMentions: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "countEstimate", "evidenceReviewIds"],
        properties: {
          label: { type: "string", maxLength: 60 },
          countEstimate: { type: "integer", minimum: 0 },
          evidenceReviewIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 }
        }
      }
    },
    serviceHighlights: { type: "array", maxItems: 3, items: { $ref: "#/$defs/evidenceClaim" } },
    atmosphereHighlights: { type: "array", maxItems: 3, items: { $ref: "#/$defs/evidenceClaim" } },
    customerTips: { type: "array", maxItems: 3, items: { $ref: "#/$defs/evidenceClaim" } },
    warnings: { type: "array", maxItems: 2, items: { $ref: "#/$defs/evidenceClaim" } },
    bestQuotes: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "evidenceReviewIds"],
        properties: {
          text: { type: "string", maxLength: 160 },
          authorName: { type: "string", maxLength: 80 },
          evidenceReviewIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 }
        }
      }
    }
  },
  $defs: {
    evidenceClaim: {
      type: "object",
      additionalProperties: false,
      required: ["title", "description", "evidenceReviewIds"],
      properties: {
        title: { type: "string", maxLength: 80 },
        description: { type: "string", maxLength: 180 },
        evidenceReviewIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 }
      }
    }
  }
} as const;

export async function analyzeReviews(input: {
  place: NormalizedPlace;
  reviews: Array<NormalizedReview & { id?: string }>;
}): Promise<ReviewAnalysis> {
  const ai = getAiProvider(process.env.AI_ANALYSIS_PROVIDER);
  const place = compactPlaceForPrompt(input.place);
  const reviews = compactReviewsForPrompt(input.reviews);

  return ai.generateObject({
    name: "review_analysis",
    schema: reviewAnalysisSchema,
    jsonSchema: reviewAnalysisJsonSchema,
    temperature: 0.1,
    model: process.env.AI_ANALYSIS_MODEL,
    system: "You do a fast, concise review analysis for a local business website. Return Russian text only. Do not invent facts. Every meaningful claim must include evidenceReviewIds.",
    prompt: `Analyze the short review sample and return only compact JSON matching the schema.

Rules:
- Use Russian language in all values.
- Prefer 2-3 strong conclusions, not a full research report.
- Every claim must include evidenceReviewIds.
- Return empty arrays when evidence is weak.
- Do not invent facts that are not present in the reviews.
- Best quotes must be short verbatim review fragments.

Place:
${JSON.stringify(place)}

Reviews:
${JSON.stringify(reviews)}`
  });
}
