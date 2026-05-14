import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exportSiteHtml } from "@/lib/site/exportSiteHtml";
import { cleanGeneratedSiteContent, generatedSiteSchema } from "@/lib/site/generateSiteContent";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

function filename(slug: string): string {
  return `${slug.replace(/[^a-z0-9-]/gi, "-") || "site"}.html`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const db = getDb();
  const site = await db.generatedSite.findUnique({
    where: { slug },
    include: {
      project: {
        include: {
          place: true,
          reviews: {
            select: {
              id: true,
              authorName: true,
              text: true,
              images: true
            }
          }
        }
      }
    }
  });

  if (!site?.project.place) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const content = generatedSiteSchema.safeParse(site.content);
  if (!content.success) {
    return NextResponse.json({ error: "Generated site has invalid content" }, { status: 422 });
  }

  const html = exportSiteHtml({
    content: cleanGeneratedSiteContent(content.data),
    place: site.project.place,
    reviews: site.project.reviews,
    routeUrl: site.project.sourceUrl
  });

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${filename(site.slug)}"`
    }
  });
}
