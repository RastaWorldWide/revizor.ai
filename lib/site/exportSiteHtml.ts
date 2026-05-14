import type { Place, Review } from "@prisma/client";
import type { GeneratedSiteContent } from "./generateSiteContent";

type ExportReview = Pick<Review, "id" | "authorName" | "text" | "images">;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeCss(value: string): string {
  return value.replace(/[;"{}]/g, "");
}

function getReviewPhotos(reviews: ExportReview[]): string[] {
  return reviews
    .flatMap((review) => (Array.isArray(review.images) ? review.images : []))
    .filter((image): image is string => typeof image === "string" && image.startsWith("http"))
    .slice(0, 12);
}

function sectionHtml(section: GeneratedSiteContent["sections"][number]): string {
  const items = section.items
    .map(
      (item) => `<article class="card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`
    )
    .join("");

  return `<section id="${escapeHtml(section.type)}" class="section"><div class="section-head"><p class="eyebrow">${escapeHtml(
    section.type
  )}</p><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.intro)}</p></div><div class="grid">${items}</div></section>`;
}

export function exportSiteHtml(input: {
  content: GeneratedSiteContent;
  place: Place;
  reviews: ExportReview[];
  routeUrl: string;
}): string {
  const { content, place, reviews, routeUrl } = input;
  const photos = getReviewPhotos(reviews);
  const nav = content.sections
    .filter((section) => section.type !== "final_cta")
    .slice(0, 6)
    .map((section) => `<a href="#${escapeHtml(section.type)}">${escapeHtml(section.title)}</a>`)
    .join("");
  const gallery = photos.map((photo) => `<img src="${escapeHtml(photo)}" alt="${escapeHtml(place.name)}" loading="lazy">`).join("");

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(content.seo.title)}</title>
  <meta name="description" content="${escapeHtml(content.seo.description)}">
  <style>
    :root {
      --bg: ${safeCss(content.theme.backgroundColor)};
      --text: ${safeCss(content.theme.textColor)};
      --primary: ${safeCss(content.theme.primaryColor)};
      --accent: ${safeCss(content.theme.accentColor)};
      --muted: ${safeCss(content.theme.textColor)}b3;
      --line: ${safeCss(content.theme.textColor)}22;
      --soft: ${safeCss(content.theme.accentColor)}14;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, Arial, sans-serif; }
    a { color: inherit; text-decoration: none; }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
    .nav { position: sticky; top: 0; z-index: 10; border-bottom: 1px solid var(--line); background: var(--bg); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 20px; max-width: 1120px; margin: 0 auto; }
    .nav-links { display: flex; gap: 18px; color: var(--muted); font-size: 14px; }
    .button { display: inline-flex; justify-content: center; border-radius: 8px; background: var(--primary); color: white; padding: 12px 18px; font-weight: 650; }
    .button.secondary { background: transparent; border: 1px solid var(--line); color: var(--text); }
    .hero { min-height: 82vh; display: grid; align-content: center; gap: 38px; grid-template-columns: 1.05fr .95fr; padding-top: 48px; padding-bottom: 64px; }
    .eyebrow { margin: 0 0 14px; color: var(--accent); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    h1 { margin: 0; font-size: clamp(44px, 7vw, 84px); line-height: .95; letter-spacing: 0; }
    h2 { margin: 0; font-size: clamp(32px, 5vw, 56px); line-height: 1.05; letter-spacing: 0; }
    h3 { margin: 0; font-size: 20px; }
    p { color: var(--muted); line-height: 1.7; }
    .hero p { font-size: 20px; max-width: 680px; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 520px; margin-top: 38px; }
    .metric { border-top: 1px solid var(--line); padding-top: 14px; }
    .metric strong { display: block; font-size: 32px; }
    .photo-main { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); background: white; }
    .photo-empty { border: 1px solid var(--line); border-radius: 10px; background: white; padding: 28px; }
    .section { border-top: 1px solid var(--line); padding: 82px 20px; max-width: 1120px; margin: 0 auto; }
    .section-head { max-width: 760px; margin-bottom: 34px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .card { border: 1px solid var(--line); border-radius: 10px; background: rgba(255,255,255,.66); padding: 24px; }
    .gallery { border-top: 1px solid var(--line); background: var(--soft); padding: 72px 20px; }
    .gallery-grid { max-width: 1120px; margin: 28px auto 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .gallery img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); }
    .cta { margin: 72px auto; max-width: 1120px; border-radius: 12px; background: var(--primary); color: white; padding: 42px; display: grid; gap: 20px; grid-template-columns: 1fr auto; align-items: end; }
    .cta p { color: rgba(255,255,255,.78); }
    .cta .button { background: white; color: var(--primary); }
    footer { border-top: 1px solid var(--line); padding: 28px 20px; color: var(--muted); font-size: 14px; }
    @media (max-width: 820px) {
      .hero, .cta { grid-template-columns: 1fr; }
      .nav-links { display: none; }
      .grid, .gallery-grid { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <header class="nav"><nav class="nav-inner"><strong>${escapeHtml(place.name)}</strong><div class="nav-links">${nav}</div><a class="button" href="${escapeHtml(
    routeUrl
  )}" target="_blank" rel="noreferrer">Маршрут в 2ГИС</a></nav></header>
  <main>
    <section class="wrap hero">
      <div>
        <p class="eyebrow">${escapeHtml(content.hero.eyebrow)}</p>
        <h1>${escapeHtml(content.hero.title)}</h1>
        <p>${escapeHtml(content.hero.subtitle)}</p>
        <div class="actions">
          <a class="button" href="${escapeHtml(routeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(content.hero.primaryCta)}</a>
          <a class="button secondary" href="#why_choose_us">${escapeHtml(content.hero.secondaryCta)}</a>
        </div>
        <div class="metrics">
          <div class="metric"><strong>${escapeHtml(place.rating ?? "-")}</strong><span>рейтинг</span></div>
          <div class="metric"><strong>${escapeHtml(place.reviewsCount ?? reviews.length)}</strong><span>отзывов</span></div>
          <div class="metric"><strong>${photos.length}</strong><span>фото</span></div>
        </div>
      </div>
      <div>${
        photos[0]
          ? `<img class="photo-main" src="${escapeHtml(photos[0])}" alt="${escapeHtml(place.name)}">`
          : `<div class="photo-empty"><p class="eyebrow">2ГИС</p><h3>${escapeHtml(place.name)}</h3><p>${escapeHtml(place.fullAddress ?? place.address ?? "")}</p></div>`
      }</div>
    </section>
    ${content.sections.filter((section) => section.type !== "final_cta").map(sectionHtml).join("")}
    ${
      photos.length
        ? `<section class="gallery"><div class="wrap"><p class="eyebrow">Фото из отзывов</p><h2>Живые кадры гостей</h2></div><div class="gallery-grid">${gallery}</div></section>`
        : ""
    }
    <section class="cta"><div><p class="eyebrow">Следующий шаг</p><h2>${escapeHtml(content.cta.title)}</h2><p>${escapeHtml(
      content.cta.text
    )}</p></div><a class="button" href="${escapeHtml(routeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(content.cta.buttonText)}</a></section>
  </main>
  <footer><div class="wrap">${escapeHtml(content.footer.text)}</div></footer>
</body>
</html>`;
}
