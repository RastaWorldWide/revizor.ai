import { z } from "zod";
import type { NormalizedPlace } from "@/lib/2gis/types";
import type { NormalizedReview } from "@/lib/reviews/ReviewsProvider";
import type { ReviewAnalysis } from "@/lib/ai/analyzeReviews";
import { getAiProvider } from "@/lib/ai/getAiProvider";
import { compactPlaceForPrompt, compactReviewsForPrompt } from "@/lib/ai/promptInputs";
import { buildFallbackSiteContent } from "./fallbackSiteContent";

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
      type: z.enum(["why_choose_us", "mood", "business_specific", "popular_mentions", "quotes", "tips", "hours", "map", "final_cta"]),
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
            enum: ["why_choose_us", "mood", "business_specific", "popular_mentions", "quotes", "tips", "hours", "map", "final_cta"]
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
  const ai = getAiProvider(process.env.AI_SITE_PROVIDER);
  const place = compactPlaceForPrompt(input.place);
  const reviews = compactReviewsForPrompt(input.reviews, {
    maxReviews: Number(process.env.AI_MAX_REVIEWS_FOR_SITE) || 5,
    maxTextChars: Number(process.env.AI_REVIEW_MAX_CHARS) || 220
  });

  try {
    const content = await withTimeout(
      ai.generateObject({
    name: "generated_site_content",
    schema: generatedSiteSchema,
    jsonSchema: generatedSiteJsonSchema,
    temperature: 0.25,
    model: process.env.AI_SITE_MODEL,
    system: "You create premium one-page website content for a local business. Return Russian text only. Be concrete, concise, commercial, and never make unsupported claims.",
    prompt: `Create website content only as JSON matching the schema.

Possible sections:
- why_choose_us
- mood
- business_specific
- popular_mentions
- quotes
- tips
- hours
- map
- final_cta

Rules:
- Use Russian language in all values.
- Write like a professional local business website, not like a review summary.
- Keep titles short and specific. Avoid generic section titles like "Наши преимущества".
- Make hero title memorable but factual. Put value and mood in subtitle.
- The website style must reflect the emotional profile of the reviews.
- Do not generate unsupported claims.
- Do not add a section just to fill the page. Return fewer sections when evidence is weak.
- Add business_specific only when reviews clearly mention services, products, dishes, choice, process, masters, doctors, assortment, or other concrete offer details.
- Adapt business_specific to businessType:
  restaurant/cafe: dishes, breakfasts, occasions, atmosphere; salon: services and masters; clinic: trust and process; store: assortment and choice.
  Use only topics proven by reviews.
- Sections should have 2-4 strong items. If a section has fewer than 2 useful items, skip that section.
- Add evidenceReviewIds for all claims based on reviews.
- For hours and map, use place card data without evidenceReviewIds, but skip them if there is no useful place data.
- Navigation must include only sections that are returned. Navigation href values must point to section ids: #why_choose_us, #mood, #business_specific, etc.

Place:
${JSON.stringify(place)}

Analysis:
${JSON.stringify(input.analysis)}

Short review sample:
${JSON.stringify(reviews)}`
      }),
      Number(process.env.AI_SITE_GENERATION_TIMEOUT_MS) || 25000
    );

    return cleanGeneratedSiteContent(content);
  } catch (error) {
    if (process.env.AI_SITE_FALLBACK_ON_ERROR === "false") {
      throw error;
    }

    return cleanGeneratedSiteContent(buildFallbackSiteContent(input));
  }
}

export function cleanGeneratedSiteContent(content: GeneratedSiteContent): GeneratedSiteContent {
  const sections = content.sections
    .map((section) => ({
      ...section,
      items: section.items.filter(isUsefulItem)
    }))
    .filter(isUsefulSection);
  const sectionIds = new Set(sections.map((section) => `#${section.type}`));

  return {
    ...content,
    navigation: content.navigation.filter((item) => sectionIds.has(item.href)),
    sections
  };
}

function isUsefulItem(item: GeneratedSiteContent["sections"][number]["items"][number]): boolean {
  const title = item.title.trim();
  const text = item.text.trim();
  return title.length >= 3 && text.length >= 18 && title !== text;
}

function isUsefulSection(section: GeneratedSiteContent["sections"][number]): boolean {
  if (section.type === "hours" || section.type === "map" || section.type === "final_cta") {
    return section.items.length > 0 && section.title.trim().length > 0;
  }

  if (section.type === "quotes") {
    return section.items.length > 0;
  }

  return section.items.length >= 2 && section.title.trim().length > 0 && section.intro.trim().length >= 20;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`AI site generation timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
