import type { NormalizedPlace } from "@/lib/2gis/types";
import type { ReviewAnalysis } from "@/lib/ai/analyzeReviews";
import type { GeneratedSiteContent } from "./generateSiteContent";

function first<T>(items: T[] | undefined): T | undefined {
  return items?.[0];
}

function evidence(items: Array<{ evidenceReviewIds: string[] }> | undefined): string[] {
  return first(items)?.evidenceReviewIds ?? [];
}

function claimItems(items: Array<{ title: string; description: string; evidenceReviewIds: string[] }> | undefined, fallback: string) {
  const source = items?.length ? items : [{ title: fallback, description: fallback, evidenceReviewIds: [] }];

  return source.slice(0, 3).map((item) => ({
    title: item.title,
    text: item.description || fallback,
    evidenceReviewIds: item.evidenceReviewIds
  }));
}

export function buildFallbackSiteContent(input: { place: NormalizedPlace; analysis: ReviewAnalysis }): GeneratedSiteContent {
  const popularMentions = input.analysis.popularMentions.slice(0, 4).map((item) => ({
    title: item.label,
    text: `Эту тему гости часто отмечают в отзывах.`,
    evidenceReviewIds: item.evidenceReviewIds
  }));

  return {
    theme: {
      primaryColor: "#1d1b18",
      backgroundColor: "#f7f4ef",
      textColor: "#1d1b18",
      accentColor: "#8b5e3c",
      mood: input.analysis.styleDna.tone
    },
    seo: {
      title: `${input.place.name} - ${input.analysis.businessType}`,
      description: first(input.analysis.mainReasonsToVisit)?.description ?? input.place.fullAddress ?? input.place.address ?? input.place.name
    },
    hero: {
      eyebrow: input.analysis.businessType,
      title: input.place.name,
      subtitle: first(input.analysis.emotionalProfile)?.description ?? "Страница собрана на основе отзывов гостей и карточки места.",
      primaryCta: "Построить маршрут",
      secondaryCta: "Посмотреть отзывы",
      evidenceReviewIds: evidence(input.analysis.emotionalProfile)
    },
    navigation: [
      { label: "Почему мы", href: "#why_choose_us" },
      { label: "Атмосфера", href: "#mood" },
      { label: "Что предлагаем", href: "#business_specific" },
      { label: "Часто упоминается", href: "#popular_mentions" },
      { label: "Отзывы", href: "#quotes" }
    ],
    sections: [
      {
        type: "why_choose_us",
        title: "Почему сюда идут",
        intro: "Главные причины визита по отзывам гостей.",
        items: claimItems(input.analysis.mainReasonsToVisit, "Гости отмечают сильные стороны места")
      },
      {
        type: "mood",
        title: "Атмосфера",
        intro: "Настроение места по отзывам.",
        items: claimItems(input.analysis.atmosphereHighlights, "Атмосфера считывается через отзывы гостей")
      },
      {
        type: "business_specific",
        title: "Что предлагают",
        intro: "Ключевые детали, которые гости выделяют в отзывах.",
        items: claimItems(input.analysis.serviceHighlights, "Предложения и услуги стоит уточнить перед визитом")
      },
      {
        type: "popular_mentions",
        title: "Часто упоминается",
        intro: "Темы, которые чаще всего встречаются в отзывах.",
        items: popularMentions.length ? popularMentions : claimItems(input.analysis.serviceHighlights, "Частые темы отзывов")
      },
      {
        type: "quotes",
        title: "Отзывы гостей",
        intro: "Короткие цитаты из отзывов.",
        items: input.analysis.bestQuotes.map((quote) => ({
          title: quote.authorName ?? "Гость",
          text: quote.text,
          evidenceReviewIds: quote.evidenceReviewIds
        }))
      },
      {
        type: "tips",
        title: "Перед визитом",
        intro: "Полезные подсказки из отзывов.",
        items: claimItems(input.analysis.customerTips, "Уточните детали перед визитом")
      },
      {
        type: "hours",
        title: "График работы",
        intro: "Актуальное расписание лучше сверить в карточке.",
        items: [{ title: "Часы работы", text: "Проверьте расписание перед визитом.", evidenceReviewIds: [] }]
      },
      {
        type: "map",
        title: "Как добраться",
        intro: input.place.fullAddress ?? input.place.address ?? "Откройте маршрут в 2ГИС.",
        items: [{ title: "Маршрут", text: "Постройте маршрут до места в 2ГИС.", evidenceReviewIds: [] }]
      },
      {
        type: "final_cta",
        title: "Запланируйте визит",
        intro: "Откройте карточку и выберите удобный маршрут.",
        items: [{ title: "Следующий шаг", text: "Построить маршрут и уточнить детали перед визитом.", evidenceReviewIds: [] }]
      }
    ],
    cta: {
      title: "Готовы заглянуть?",
      text: "Постройте маршрут и уточните детали перед визитом.",
      buttonText: "Построить маршрут"
    },
    footer: {
      text: `${input.place.name}. Сайт собран на основе открытых данных и отзывов.`
    }
  };
}
