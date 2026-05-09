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

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const resolved = await resolve2gisLink(input.url);
    const placeProvider = new Apify2gisPlaceProvider();
    const place = await placeProvider.getPlace({
      placeUrl: resolved.resolvedUrl,
      resolved
    });
    const project = await upsertProjectPlace({
      sourceUrl: resolved.resolvedUrl,
      place
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

    const analysis = await analyzeReviews({ place, reviews: normalizedReviews });
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

    return NextResponse.json({
      projectId: project.id,
      slug: project.slug,
      reviewsCount: reviews.length,
      analysis,
      content,
      publicPath: `/s/${generatedSite.slug}`,
      publicUrl: `${appUrl}/s/${generatedSite.slug}`
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate demo site"
      },
      { status: 400 }
    );
  }
}
