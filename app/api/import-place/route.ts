import { NextResponse } from "next/server";
import { z } from "zod";
import { resolve2gisLink } from "@/lib/2gis/resolve2gisLink";
import { Apify2gisPlaceProvider } from "@/lib/places/Apify2gisPlaceProvider";
import { upsertProjectPlace } from "@/lib/projects/upsertProjectPlace";

const requestSchema = z.object({
  url: z.string().url()
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

    return NextResponse.json({ resolved, project });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to import place"
      },
      { status: 400 }
    );
  }
}
