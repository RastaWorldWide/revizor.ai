import { z } from "zod";
import { getAiProvider } from "./getAiProvider";
import type { NormalizedPlace } from "@/lib/2gis/types";
import type { NormalizedReview } from "@/lib/reviews/ReviewsProvider";
import { compactPlaceForPrompt, compactReviewsForPrompt } from "./promptInputs";

const evidenceClaimSchema = z.object({
  title: z.string(),
  description: z.string(),
  evidenceReviewIds: z.array(z.string()).min(1)
});

export const reviewAnalysisSchema = z.object({
  businessType: z.string(),
  audience: z.array(evidenceClaimSchema),
  emotionalProfile: z.array(evidenceClaimSchema),
  styleDna: z.object({
    tone: z.string(),
    adjectives: z.array(z.string()),
    colors: z.array(z.string()),
    typography: z.string()
  }),
  mainReasonsToVisit: z.array(evidenceClaimSchema),
  popularMentions: z.array(
    z.object({
      label: z.string(),
      countEstimate: z.number().int().nonnegative(),
      evidenceReviewIds: z.array(z.string()).min(1)
    })
  ),
  serviceHighlights: z.array(evidenceClaimSchema),
  atmosphereHighlights: z.array(evidenceClaimSchema),
  customerTips: z.array(evidenceClaimSchema),
  warnings: z.array(evidenceClaimSchema),
  bestQuotes: z.array(
    z.object({
      text: z.string(),
      authorName: z.string().optional(),
      evidenceReviewIds: z.array(z.string()).min(1)
    })
  )
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
    audience: { type: "array", items: { $ref: "#/$defs/evidenceClaim" } },
    emotionalProfile: { type: "array", items: { $ref: "#/$defs/evidenceClaim" } },
    styleDna: {
      type: "object",
      additionalProperties: false,
      required: ["tone", "adjectives", "colors", "typography"],
      properties: {
        tone: { type: "string" },
        adjectives: { type: "array", items: { type: "string" } },
        colors: { type: "array", items: { type: "string" } },
        typography: { type: "string" }
      }
    },
    mainReasonsToVisit: { type: "array", items: { $ref: "#/$defs/evidenceClaim" } },
    popularMentions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "countEstimate", "evidenceReviewIds"],
        properties: {
          label: { type: "string" },
          countEstimate: { type: "integer", minimum: 0 },
          evidenceReviewIds: { type: "array", items: { type: "string" }, minItems: 1 }
        }
      }
    },
    serviceHighlights: { type: "array", items: { $ref: "#/$defs/evidenceClaim" } },
    atmosphereHighlights: { type: "array", items: { $ref: "#/$defs/evidenceClaim" } },
    customerTips: { type: "array", items: { $ref: "#/$defs/evidenceClaim" } },
    warnings: { type: "array", items: { $ref: "#/$defs/evidenceClaim" } },
    bestQuotes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "evidenceReviewIds"],
        properties: {
          text: { type: "string" },
          authorName: { type: "string" },
          evidenceReviewIds: { type: "array", items: { type: "string" }, minItems: 1 }
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
        title: { type: "string" },
        description: { type: "string" },
        evidenceReviewIds: { type: "array", items: { type: "string" }, minItems: 1 }
      }
    }
  }
} as const;

export async function analyzeReviews(input: {
  place: NormalizedPlace;
  reviews: Array<NormalizedReview & { id?: string }>;
}): Promise<ReviewAnalysis> {
  const ai = getAiProvider();
  const place = compactPlaceForPrompt(input.place);
  const reviews = compactReviewsForPrompt(input.reviews);

  return ai.generateObject({
    name: "review_analysis",
    schema: reviewAnalysisSchema,
    jsonSchema: reviewAnalysisJsonSchema,
    temperature: 0.1,
    system: "You analyze customer reviews for local businesses. Return Russian text only. Do not invent facts. Every meaningful claim must include evidenceReviewIds.",
    prompt: `Analyze the reviews and return only JSON matching the schema.

Rules:
- Use Russian language in all values.
- Every main claim must include evidenceReviewIds.
- Return fewer items if evidence is weak.
- Do not invent facts that are not present in the reviews.
- Best quotes must be short verbatim review fragments.

Place:
${JSON.stringify(place)}

Reviews:
${JSON.stringify(reviews)}`
  });
}
