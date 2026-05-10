import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { reviewAnalysisSchema, type ReviewAnalysis } from "@/lib/ai/analyzeReviews";
import { getDb } from "@/lib/db";
import { generatedSiteSchema, type GeneratedSiteContent } from "@/lib/site/generateSiteContent";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type ReviewPhoto = {
  id: string;
  src: string;
  authorName: string | null;
  text: string;
};

type Section = GeneratedSiteContent["sections"][number];

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
): ReviewPhoto[] {
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

function getSectionId(type: Section["type"]) {
  return type;
}

function shortText(text: string, max = 130) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function getPrimaryNavigation(sections: Section[], hasPhotos: boolean) {
  const available = new Set(sections.map((section) => section.type));
  const items = [
    { label: "Почему мы", href: "#why_choose_us", type: "why_choose_us" },
    { label: "Атмосфера", href: "#mood", type: "mood" },
    { label: "Что предлагаем", href: "#business_specific", type: "business_specific" },
    { label: "Часто упоминается", href: "#popular_mentions", type: "popular_mentions" },
    { label: "Отзывы", href: "#quotes", type: "quotes" }
  ].filter((item) => available.has(item.type as Section["type"]));

  if (hasPhotos) {
    items.push({ label: "Фото", href: "#review_photos", type: "quotes" });
  }

  return items;
}

function sectionItem(title: string, text: string, evidenceReviewIds: string[] = []): Section["items"][number] {
  return {
    title,
    text,
    evidenceReviewIds
  };
}

function claimItems(claims: Array<{ title: string; description: string; evidenceReviewIds: string[] }>, fallback: Section["items"]): Section["items"] {
  const items = claims.slice(0, 4).map((claim) => sectionItem(claim.title, claim.description, claim.evidenceReviewIds));
  return items.length > 0 ? items : fallback;
}

function mentionItems(analysis: ReviewAnalysis | null, fallback: Section["items"]): Section["items"] {
  const items =
    analysis?.popularMentions.slice(0, 6).map((mention) =>
      sectionItem(
        mention.label,
        mention.countEstimate > 1 ? `Эту тему гости упоминают чаще других: примерно ${mention.countEstimate} раз.` : "Эта тема встречается в отзывах гостей.",
        mention.evidenceReviewIds
      )
    ) ?? [];

  return items.length > 0 ? items : fallback;
}

function buildCoreSection(type: Section["type"], analysis: ReviewAnalysis | null, placeName: string, content: GeneratedSiteContent): Section | null {
  if (type === "why_choose_us") {
    return {
      type,
      title: `Почему выбирают ${placeName}`,
      intro: "Коротко о том, что помогает гостям принять решение и вернуться снова.",
      items: claimItems(analysis?.mainReasonsToVisit ?? [], [
        sectionItem("Решение на основе отзывов", "Страница собрана из реальных отзывов гостей, поэтому акценты отражают то, что люди уже отмечают сами."),
        sectionItem("Понятная карточка места", "Адрес, рейтинг, отзывы и маршрут собраны рядом, чтобы посетителю не приходилось искать детали отдельно."),
        sectionItem("Без неподтвержденных обещаний", "Тексты не придумывают лишнего и опираются на данные карточки и отзывы.")
      ])
    };
  }

  if (type === "mood") {
    return {
      type,
      title: "Атмосфера по отзывам",
      intro: `Настроение страницы: ${content.theme.mood}. Оно собрано из формулировок гостей и общего тона отзывов.`,
      items: claimItems([...(analysis?.emotionalProfile ?? []), ...(analysis?.atmosphereHighlights ?? [])], [
        sectionItem("Живое впечатление", "Этот блок показывает не список услуг, а ощущение, которое остается у посетителей после визита."),
        sectionItem("Тональность отзывов", "Цвета, темп и подача страницы подстроены под эмоциональный профиль места.")
      ])
    };
  }

  if (type === "business_specific") {
    return {
      type,
      title: "Что предлагаем",
      intro: "Самые прикладные причины зайти: то, что гости упоминают в контексте еды, услуг, сервиса, выбора или процесса.",
      items: claimItems([...(analysis?.serviceHighlights ?? []), ...(analysis?.mainReasonsToVisit ?? [])], [
        sectionItem("Главные поводы для визита", "Блок адаптируется под тип бизнеса: ресторан, салон, клинику, сервис или магазин."),
        sectionItem("То, что важно посетителю", "На первый план выводятся не общие обещания, а конкретные темы из отзывов.")
      ])
    };
  }

  if (type === "popular_mentions") {
    return {
      type,
      title: "Часто упоминается",
      intro: "Повторяющиеся темы помогают быстро понять, чем место запоминается гостям.",
      items: mentionItems(analysis, [
        sectionItem("Отзывы гостей", "Когда отзывов станет больше, здесь появятся наиболее частые темы и формулировки."),
        sectionItem("Главные акценты", "Секция показывает повторяющиеся причины интереса к месту.")
      ])
    };
  }

  return null;
}

function ensureCoreSections(sections: Section[], analysis: ReviewAnalysis | null, placeName: string, content: GeneratedSiteContent): Section[] {
  const order: Section["type"][] = ["why_choose_us", "mood", "business_specific", "popular_mentions"];
  const byType = new Map(sections.map((section) => [section.type, section]));
  const coreSections = order
    .map((type) => byType.get(type) ?? buildCoreSection(type, analysis, placeName, content))
    .filter((section): section is Section => Boolean(section));
  const rest = sections.filter((section) => !order.includes(section.type));

  return [...coreSections, ...rest];
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

const sectionLabels: Record<Section["type"], string> = {
  why_choose_us: "Почему выбирают",
  mood: "Настроение",
  business_specific: "По делу",
  popular_mentions: "Часто отмечают",
  quotes: "Голоса гостей",
  tips: "Полезно знать",
  hours: "Режим работы",
  map: "Как добраться",
  final_cta: "Следующий шаг"
};

function SectionIntro({ section, align = "left" }: { section: Section; align?: "left" | "center" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">{sectionLabels[section.type]}</p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-5xl">{section.title}</h2>
      <p className="mt-4 text-lg leading-8 text-[color:var(--muted)]">{section.intro}</p>
    </div>
  );
}

function WhyChooseSection({ section }: { section: Section }) {
  return (
    <section id={getSectionId(section.type)} className="scroll-mt-24 border-t border-[color:var(--line)] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <SectionIntro section={section} />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {section.items.slice(0, 3).map((item, index) => (
            <article key={`${section.type}-${index}`} className="rounded-lg border border-[color:var(--line)] bg-white/75 p-6">
              <div className="font-mono text-sm text-[color:var(--accent)]">0{index + 1}</div>
              <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
              <p className="mt-4 leading-7 text-[color:var(--muted)]">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MoodSection({ section }: { section: Section }) {
  return (
    <section id={getSectionId(section.type)} className="scroll-mt-24 border-t border-[color:var(--line)] bg-[color:var(--soft)] py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionIntro section={section} />
        <div className="grid content-center gap-3">
          {section.items.slice(0, 4).map((item, index) => (
            <article key={`${section.type}-${index}`} className="border-l-2 border-[color:var(--accent)] bg-white/55 px-5 py-4">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 leading-7 text-[color:var(--muted)]">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BusinessSpecificSection({ section }: { section: Section }) {
  return (
    <section id={getSectionId(section.type)} className="scroll-mt-24 border-t border-[color:var(--line)] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg bg-[color:var(--primary)] p-7 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/70">{sectionLabels[section.type]}</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight">{section.title}</h2>
            <p className="mt-5 leading-8 text-white/80">{section.intro}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.items.slice(0, 4).map((item, index) => (
              <article key={`${section.type}-${index}`} className="rounded-lg border border-[color:var(--line)] bg-white/75 p-5">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 leading-7 text-[color:var(--muted)]">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PopularMentionsSection({ section }: { section: Section }) {
  return (
    <section id={getSectionId(section.type)} className="scroll-mt-24 border-t border-[color:var(--line)] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <SectionIntro section={section} align="center" />
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {section.items.slice(0, 8).map((item, index) => (
            <div key={`${section.type}-${index}`} className="rounded-full border border-[color:var(--line)] bg-white/75 px-5 py-3">
              <span className="font-medium">{item.title}</span>
              <span className="ml-2 text-[color:var(--muted)]">{shortText(item.text, 72)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuotesSection({ section }: { section: Section }) {
  const [lead, ...rest] = section.items;

  return (
    <section id={getSectionId(section.type)} className="scroll-mt-24 border-t border-[color:var(--line)] bg-[color:var(--soft)] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <SectionIntro section={section} />
        <div className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          {lead ? (
            <blockquote className="rounded-lg bg-white/75 p-7 text-2xl font-medium leading-10 sm:p-9 sm:text-3xl">
              <span>&ldquo;{lead.text}&rdquo;</span>
              <footer className="mt-6 text-base font-normal text-[color:var(--muted)]">{lead.title}</footer>
            </blockquote>
          ) : null}
          <div className="grid gap-4">
            {rest.slice(0, 3).map((item, index) => (
              <blockquote key={`${section.type}-${index}`} className="rounded-lg border border-[color:var(--line)] bg-white/65 p-5">
                <div className="font-medium">&ldquo;{item.text}&rdquo;</div>
                <footer className="mt-3 text-sm text-[color:var(--muted)]">{item.title}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TipsSection({ section }: { section: Section }) {
  return (
    <section id={getSectionId(section.type)} className="scroll-mt-24 border-t border-[color:var(--line)] py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionIntro section={section} />
        <div className="grid gap-3">
          {section.items.slice(0, 5).map((item, index) => (
            <article key={`${section.type}-${index}`} className="grid grid-cols-[2rem_1fr] gap-4 rounded-lg border border-[color:var(--line)] bg-white/75 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)] text-sm font-semibold text-white">{index + 1}</div>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 leading-7 text-[color:var(--muted)]">{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function OperationalSection({ section }: { section: Section }) {
  return (
    <section id={getSectionId(section.type)} className="scroll-mt-24 border-t border-[color:var(--line)] py-14">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-6 rounded-lg border border-[color:var(--line)] bg-white/70 p-6 md:grid-cols-[0.75fr_1.25fr]">
          <SectionIntro section={section} />
          <div className="grid gap-3 sm:grid-cols-2">
            {section.items.slice(0, 4).map((item, index) => (
              <div key={`${section.type}-${index}`} className="border-t border-[color:var(--line)] pt-4">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DefaultSection({ section }: { section: Section }) {
  return (
    <section id={getSectionId(section.type)} className="scroll-mt-24 border-t border-[color:var(--line)] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <SectionIntro section={section} />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {section.items.map((item, index) => (
            <article key={`${section.type}-${index}`} className="rounded-lg border border-[color:var(--line)] bg-white/75 p-5">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-3 leading-7 text-[color:var(--muted)]">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RenderSection({ section }: { section: Section }) {
  if (section.type === "why_choose_us") {
    return <WhyChooseSection section={section} />;
  }
  if (section.type === "mood") {
    return <MoodSection section={section} />;
  }
  if (section.type === "business_specific") {
    return <BusinessSpecificSection section={section} />;
  }
  if (section.type === "popular_mentions") {
    return <PopularMentionsSection section={section} />;
  }
  if (section.type === "quotes") {
    return <QuotesSection section={section} />;
  }
  if (section.type === "tips") {
    return <TipsSection section={section} />;
  }
  if (section.type === "hours" || section.type === "map") {
    return <OperationalSection section={section} />;
  }
  return <DefaultSection section={section} />;
}

function ReviewPhotoCollage({ photos, placeName }: { photos: ReviewPhoto[]; placeName: string }) {
  if (photos.length === 0) {
    return (
      <div className="rounded-lg border border-[color:var(--line)] bg-white/65 p-6">
        <div className="font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--accent)]">2ГИС</div>
        <div className="mt-4 text-2xl font-semibold">{placeName}</div>
        <p className="mt-3 leading-7 text-[color:var(--muted)]">Страница собрана из отзывов гостей и данных карточки места.</p>
      </div>
    );
  }

  const [main, ...rest] = photos;

  return (
    <div className="grid gap-3">
      <figure className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-white/70">
        {/* Review images come from arbitrary 2GIS/Apify hosts, so use a plain image tag. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="aspect-[4/3] w-full object-cover" src={main.src} alt={`Фото из отзывов ${placeName}`} />
      </figure>
      <div className="grid grid-cols-3 gap-3">
        {rest.slice(0, 3).map((photo) => (
          <figure key={photo.id} className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-white/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="aspect-square w-full object-cover" src={photo.src} alt={photo.authorName ? `Фото из отзыва ${photo.authorName}` : "Фото из отзыва"} />
          </figure>
        ))}
      </div>
    </div>
  );
}

function ReviewPhotos({ photos }: { photos: ReviewPhoto[] }) {
  if (photos.length === 0) {
    return null;
  }

  return (
    <section id="review_photos" className="scroll-mt-24 border-t border-[color:var(--line)] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">Фото из отзывов</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-5xl">Живые кадры гостей</h2>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
            Такие фотографии не выглядят как постановочная съемка. Они показывают место так, как его реально видят посетители.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {photos.slice(0, 12).map((photo) => (
            <figure key={photo.id} className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-white/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="aspect-[4/3] w-full object-cover" src={photo.src} alt={photo.authorName ? `Фото из отзыва ${photo.authorName}` : "Фото из отзыва"} />
              <figcaption className="p-4 text-sm leading-6 text-[color:var(--muted)]">
                {photo.authorName ? <span className="font-medium text-[color:var(--text)]">{photo.authorName}: </span> : null}
                {shortText(photo.text, 120)}
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
  const analysis = reviewAnalysisSchema.safeParse(site.analysis);
  const place = site.project.place;
  const routeUrl = site.project.sourceUrl;
  const reviewPhotos = getReviewPhotos(site.project.reviews);
  const topSections = ensureCoreSections(
    content.sections.filter((section) => section.type !== "final_cta"),
    analysis.success ? analysis.data : null,
    place.name,
    content
  );
  const primaryNavigation = getPrimaryNavigation(topSections, reviewPhotos.length > 0);

  return (
    <main
      className="min-h-screen"
      style={
        {
          "--bg": content.theme.backgroundColor,
          "--soft": `${content.theme.accentColor}14`,
          "--text": content.theme.textColor,
          "--muted": `${content.theme.textColor}b3`,
          "--primary": content.theme.primaryColor,
          "--accent": content.theme.accentColor,
          "--line": `${content.theme.textColor}22`,
          background: "var(--bg)",
          color: "var(--text)"
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-[color:var(--bg)]/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a className="min-w-0 truncate text-base font-semibold" href="#top">
            {place.name}
          </a>
          <div className="hidden items-center gap-5 text-sm text-[color:var(--muted)] lg:flex">
            {primaryNavigation.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-[color:var(--text)]">
                {item.label}
              </a>
            ))}
          </div>
          <a className="shrink-0 rounded-md bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-white" href={routeUrl} rel="noreferrer" target="_blank">
            Маршрут в 2ГИС
          </a>
        </nav>
        <div className="border-t border-[color:var(--line)] lg:hidden">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5 py-3">
            {primaryNavigation.map((item) => (
              <a key={item.href} href={item.href} className="shrink-0 rounded-full border border-[color:var(--line)] bg-white/55 px-4 py-2 text-sm text-[color:var(--muted)]">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </header>

      <section id="top" className="mx-auto grid min-h-[86vh] max-w-6xl content-center gap-10 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-[color:var(--accent)]">{content.hero.eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-none sm:text-7xl">{content.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-xl leading-9 text-[color:var(--muted)]">{content.hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-md bg-[color:var(--primary)] px-5 py-3 font-medium text-white" href={routeUrl} rel="noreferrer" target="_blank">
              {content.hero.primaryCta}
            </a>
            <a className="rounded-md border border-[color:var(--line)] bg-white/45 px-5 py-3 font-medium" href="#why_choose_us">
              {content.hero.secondaryCta}
            </a>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            <div className="border-t border-[color:var(--line)] pt-4">
              <div className="text-3xl font-semibold">{place.rating ?? "-"}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">рейтинг</div>
            </div>
            <div className="border-t border-[color:var(--line)] pt-4">
              <div className="text-3xl font-semibold">{place.reviewsCount ?? site.project.reviews.length}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">отзывов</div>
            </div>
            <div className="border-t border-[color:var(--line)] pt-4">
              <div className="text-3xl font-semibold">{reviewPhotos.length}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">фото</div>
            </div>
          </div>
        </div>
        <div className="self-center">
          <ReviewPhotoCollage photos={reviewPhotos} placeName={place.name} />
          <div className="mt-5 rounded-lg border border-[color:var(--line)] bg-white/65 p-5">
            <div className="font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--accent)]">Карточка места</div>
            <div className="mt-3 text-xl font-semibold">{place.name}</div>
            {place.fullAddress || place.address ? <div className="mt-2 leading-7 text-[color:var(--muted)]">{place.fullAddress ?? place.address}</div> : null}
          </div>
        </div>
      </section>

      {topSections.map((section) => (
        <RenderSection key={section.type} section={section} />
      ))}

      <ReviewPhotos photos={reviewPhotos} />

      <section className="border-t border-[color:var(--line)] px-5 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 rounded-lg bg-[color:var(--primary)] p-8 text-white sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/60">Финальный шаг</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-5xl">{content.cta.title}</h2>
            <p className="mt-4 max-w-2xl text-white/80">{content.cta.text}</p>
          </div>
          <a className="inline-flex justify-center rounded-md bg-white px-5 py-3 font-medium text-[color:var(--primary)]" href={routeUrl} rel="noreferrer" target="_blank">
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
