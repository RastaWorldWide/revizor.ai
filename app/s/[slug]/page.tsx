import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { generatedSiteSchema, type GeneratedSiteContent } from "@/lib/site/generateSiteContent";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

async function getGeneratedSite(slug: string) {
  const db = getDb();

  return db.generatedSite.findUnique({
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
}

function getReviewPhotos(
  reviews: Array<{
    id: string;
    authorName: string | null;
    text: string;
    images: unknown;
  }>
) {
  return reviews.flatMap((review) => {
    if (!Array.isArray(review.images)) {
      return [];
    }

    return review.images
      .filter((image): image is string => typeof image === "string" && image.startsWith("http"))
      .slice(0, 4)
      .map((image) => ({
        id: `${review.id}-${image}`,
        src: image,
        authorName: review.authorName,
        text: review.text
      }));
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getGeneratedSite(slug);

  if (!site) {
    return {};
  }

  const content = generatedSiteSchema.safeParse(site.content);
  if (!content.success) {
    return {};
  }

  return {
    title: content.data.seo.title,
    description: content.data.seo.description
  };
}

function Section({ section }: { section: GeneratedSiteContent["sections"][number] }) {
  return (
    <section id={section.type} className="border-t border-[color:var(--line)] py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">{section.type}</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{section.title}</h2>
            <p className="mt-4 text-lg leading-8 text-[color:var(--muted)]">{section.intro}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.items.map((item, index) => (
              <article key={`${section.type}-${index}`} className="rounded-lg border border-[color:var(--line)] bg-white/70 p-5">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-3 leading-7 text-[color:var(--muted)]">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewPhotos({
  photos
}: {
  photos: Array<{
    id: string;
    src: string;
    authorName: string | null;
    text: string;
  }>;
}) {
  if (photos.length === 0) {
    return null;
  }

  return (
    <section id="review_photos" className="border-t border-[color:var(--line)] py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-8 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">review photos</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Фотографии из отзывов гостей</h2>
          <p className="mt-4 text-lg leading-8 text-[color:var(--muted)]">
            Живые кадры из отзывов помогают показать место так, как его видят реальные посетители.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {photos.slice(0, 12).map((photo) => (
            <figure key={photo.id} className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-white/70">
              {/* Review images come from arbitrary 2GIS/Apify hosts, so use a plain image tag. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="aspect-[4/3] w-full object-cover" src={photo.src} alt={photo.authorName ? `Фото из отзыва ${photo.authorName}` : "Фото из отзыва"} />
              <figcaption className="p-4 text-sm leading-6 text-[color:var(--muted)]">
                {photo.authorName ? <span className="font-medium text-[color:var(--text)]">{photo.authorName}: </span> : null}
                {photo.text.length > 120 ? `${photo.text.slice(0, 119)}…` : photo.text}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function PublicSitePage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getGeneratedSite(slug);

  if (!site?.project.place) {
    notFound();
  }

  const parsed = generatedSiteSchema.safeParse(site.content);

  if (!parsed.success) {
    notFound();
  }

  const content = parsed.data;
  const place = site.project.place;
  const routeUrl = site.project.sourceUrl;
  const reviewPhotos = getReviewPhotos(site.project.reviews);

  return (
    <main
      className="min-h-screen"
      style={
        {
          "--bg": content.theme.backgroundColor,
          "--text": content.theme.textColor,
          "--muted": `${content.theme.textColor}bb`,
          "--primary": content.theme.primaryColor,
          "--accent": content.theme.accentColor,
          "--line": `${content.theme.textColor}24`,
          background: "var(--bg)",
          color: "var(--text)"
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-[color:var(--bg)]/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a className="text-base font-semibold" href="#top">
            {place.name}
          </a>
          <div className="hidden items-center gap-5 text-sm text-[color:var(--muted)] md:flex">
            {content.navigation.slice(0, 5).map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-[color:var(--text)]">
                {item.label}
              </a>
            ))}
          </div>
          <a className="rounded-md bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-white" href={routeUrl} rel="noreferrer" target="_blank">
            Маршрут в 2ГИС
          </a>
        </nav>
      </header>

      <section id="top" className="mx-auto grid min-h-[82vh] max-w-6xl content-center gap-8 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-[color:var(--accent)]">{content.hero.eyebrow}</p>
          <h1 className="mt-5 text-5xl font-semibold leading-none sm:text-7xl">{content.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-xl leading-9 text-[color:var(--muted)]">{content.hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-md bg-[color:var(--primary)] px-5 py-3 font-medium text-white" href={routeUrl} rel="noreferrer" target="_blank">
              {content.hero.primaryCta}
            </a>
            <a className="rounded-md border border-[color:var(--line)] px-5 py-3 font-medium" href="#why_choose_us">
              {content.hero.secondaryCta}
            </a>
          </div>
        </div>
        <aside className="self-end rounded-lg border border-[color:var(--line)] bg-white/60 p-6">
          <div className="font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--accent)]">2ГИС</div>
          <div className="mt-4 text-2xl font-semibold">{place.name}</div>
          {place.fullAddress || place.address ? <div className="mt-3 text-[color:var(--muted)]">{place.fullAddress ?? place.address}</div> : null}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-xs text-[color:var(--muted)]">Рейтинг</div>
              <div className="text-2xl font-semibold">{place.rating ?? "—"}</div>
            </div>
            <div>
              <div className="font-mono text-xs text-[color:var(--muted)]">Отзывы</div>
              <div className="text-2xl font-semibold">{place.reviewsCount ?? "—"}</div>
            </div>
          </div>
        </aside>
      </section>

      {content.sections.map((section) => (
        <Section key={section.type} section={section} />
      ))}

      <ReviewPhotos photos={reviewPhotos} />

      <section className="border-t border-[color:var(--line)] px-5 py-16">
        <div className="mx-auto max-w-6xl rounded-lg bg-[color:var(--primary)] p-8 text-white sm:p-10">
          <h2 className="text-3xl font-semibold">{content.cta.title}</h2>
          <p className="mt-3 max-w-2xl text-white/80">{content.cta.text}</p>
          <a className="mt-6 inline-flex rounded-md bg-white px-5 py-3 font-medium text-[color:var(--primary)]" href={routeUrl} rel="noreferrer" target="_blank">
            {content.cta.buttonText}
          </a>
        </div>
      </section>

      <footer className="border-t border-[color:var(--line)] px-5 py-8 text-sm text-[color:var(--muted)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>{content.footer.text}</div>
          <div>Сайт собран на основе отзывов клиентов</div>
        </div>
      </footer>
    </main>
  );
}
