import { NextResponse } from "next/server";
import { z } from "zod";
import { resolve2gisLink } from "@/lib/2gis/resolve2gisLink";

const requestSchema = z.object({
  url: z.string().url()
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const resolved = await resolve2gisLink(input.url);

    return NextResponse.json(resolved);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to resolve 2GIS link"
      },
      { status: 400 }
    );
  }
}
