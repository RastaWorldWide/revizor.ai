import { z } from "zod";
import type { NormalizedPlace } from "@/lib/2gis/types";
import type { NormalizedReview } from "@/lib/reviews/ReviewsProvider";
import type { ReviewAnalysis } from "@/lib/ai/analyzeReviews";
import { getAiProvider } from "@/lib/ai/getAiProvider";
import { compactPlaceForPrompt, compactReviewsForPrompt } from "@/lib/ai/promptInputs";

const evidenceIdsSchema = z.array(z.string()).default([]);

export const generatedSiteSchema = z.object({
  theme: z.object({
    primaryColor: z.string(),
    backgroundColor: z.string(),
    textColor: z.string(),
    accentColor: z.string(),
    mood: z.string()
  }),
  seo: z.object({
    title: z.string(),
    description: z.string()
  }),
  hero: z.object({
    eyebrow: z.string(),
    title: z.string(),
    subtitle: z.string(),
    primaryCta: z.string(),
    secondaryCta: z.string(),
    evidenceReviewIds: evidenceIdsSchema
  }),
  navigation: z.array(
    z.object({
      label: z.string(),
      href: z.string()
    })
  ),
  sections: z.array(
    z.object({
      type: z.enum(["why_choose_us", "mood", "popular_mentions", "quotes", "tips", "hours", "map", "final_cta"]),
      title: z.string(),
      intro: z.string(),
      items: z.array(
        z.object({
          title: z.string(),
          text: z.string(),
          evidenceReviewIds: evidenceIdsSchema
        })
      )
    })
  ),
  cta: z.object({
    title: z.string(),
    text: z.string(),
    buttonText: z.string()
  }),
  footer: z.object({
    text: z.string()
  })
});

export type GeneratedSiteContent = z.infer<typeof generatedSiteSchema>;

export const generatedSiteJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["theme", "seo", "hero", "navigation", "sections", "cta", "footer"],
  properties: {
    theme: {
      type: "object",
      additionalProperties: false,
      required: ["primaryColor", "backgroundColor", "textColor", "accentColor", "mood"],
      properties: {
        primaryColor: { type: "string" },
        backgroundColor: { type: "string" },
        textColor: { type: "string" },
        accentColor: { type: "string" },
        mood: { type: "string" }
      }
    },
    seo: {
      type: "object",
      additionalProperties: false,
      required: ["title", "description"],
      properties: {
        title: { type: "string" },
        description: { type: "string" }
      }
    },
    hero: {
      type: "object",
      additionalProperties: false,
      required: ["eyebrow", "title", "subtitle", "primaryCta", "secondaryCta", "evidenceReviewIds"],
      properties: {
        eyebrow: { type: "string" },
        title: { type: "string" },
        subtitle: { type: "string" },
        primaryCta: { type: "string" },
        secondaryCta: { type: "string" },
        evidenceReviewIds: { type: "array", items: { type: "string" } }
      }
    },
    navigation: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "href"],
        properties: {
          label: { type: "string" },
          href: { type: "string" }
        }
      }
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "intro", "items"],
        properties: {
          type: {
            type: "string",
            enum: ["why_choose_us", "mood", "popular_mentions", "quotes", "tips", "hours", "map", "final_cta"]
          },
          title: { type: "string" },
          intro: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "text", "evidenceReviewIds"],
              properties: {
                title: { type: "string" },
                text: { type: "string" },
                evidenceReviewIds: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    },
    cta: {
      type: "object",
      additionalProperties: false,
      required: ["title", "text", "buttonText"],
      properties: {
        title: { type: "string" },
        text: { type: "string" },
        buttonText: { type: "string" }
      }
    },
    footer: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: { type: "string" }
      }
    }
  }
} as const;

export async function generateSiteContent(input: {
  place: NormalizedPlace;
  reviews: Array<NormalizedReview & { id?: string }>;
  analysis: ReviewAnalysis;
}): Promise<GeneratedSiteContent> {
  const ai = getAiProvider();
  const place = compactPlaceForPrompt(input.place);
  const reviews = compactReviewsForPrompt(input.reviews, {
    maxReviews: Number(process.env.AI_MAX_REVIEWS_FOR_SITE) || 8,
    maxTextChars: Number(process.env.AI_REVIEW_MAX_CHARS) || 300
  });

  return ai.generateObject({
    name: "generated_site_content",
    schema: generatedSiteSchema,
    jsonSchema: generatedSiteJsonSchema,
    temperature: 0.25,
    system: "You create JSON content for a one-page local business website. Return Russian text only. Be expressive but never make unsupported claims.",
    prompt: `Create website content only as JSON matching the schema.

Required sections:
- why_choose_us
- mood
- popular_mentions
- quotes
- tips
- hours
- map
- final_cta

Rules:
- Use Russian language in all values.
- The website style must reflect the emotional profile of the reviews.
- Do not generate unsupported claims.
- Add evidenceReviewIds for all claims based on reviews.
- For hours and map, use place card data without evidenceReviewIds.
- Navigation href values must point to section ids: #why_choose_us, #mood, etc.

Place:
${JSON.stringify(place)}

Analysis:
${JSON.stringify(input.analysis)}

Short review sample:
${JSON.stringify(reviews)}`
  });
}
