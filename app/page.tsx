"use client";

import { FormEvent, useMemo, useState } from "react";

type DemoResponse = {
  projectId: string;
  slug: string;
  reviewsCount: number;
  photoCount?: number;
  publicUrl: string;
  publicPath: string;
  analysis: {
    styleDna?: {
      adjectives?: string[];
    };
    popularMentions?: Array<{ label: string }>;
  };
};

type ProgressEvent = {
  type: "progress" | "done" | "error";
  step: string;
  title: string;
  message: string;
  data?: unknown;
};

const steps = [
  { id: "resolve", label: "Ссылка" },
  { id: "place", label: "Карточка" },
  { id: "reviews", label: "Отзывы" },
  { id: "analysis", label: "Анализ" },
  { id: "site", label: "Сайт" },
  { id: "done", label: "Готово" }
];

function isDemoResponse(value: unknown): value is DemoResponse {
  return Boolean(value && typeof value === "object" && "publicPath" in value);
}

function StepDot({
  active,
  done,
  label
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={[
          "h-3 w-3 shrink-0 rounded-full border",
          done ? "border-[#1d1b18] bg-[#1d1b18]" : active ? "border-[#8b5e3c] bg-[#8b5e3c]" : "border-[#d6cbbd] bg-white"
        ].join(" ")}
      />
      <span className={["truncate text-sm", active || done ? "text-[#1d1b18]" : "text-[#8b8073]"].join(" ")}>{label}</span>
    </div>
  );
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoResponse | null>(null);
  const [events, setEvents] = useState<ProgressEvent[]>([]);

  const activeStep = events.at(-1)?.step;
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeStep));
  const progressPercent = isRunning ? Math.min(92, Math.max(8, ((activeIndex + 1) / steps.length) * 100)) : result ? 100 : 0;

  const highlights = useMemo(() => {
    const adjectives = result?.analysis.styleDna?.adjectives?.slice(0, 3).join(", ");
    const mentions = result?.analysis.popularMentions?.slice(0, 3).map((item) => item.label).join(", ");
    return { adjectives, mentions };
  }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunning(true);
    setError(null);
    setResult(null);
    setEvents([]);

    try {
      const response = await fetch("/api/generate-demo/stream", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ url, limit: 60 })
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Не удалось запустить генерацию");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const parsed = JSON.parse(line) as ProgressEvent;
          setEvents((current) => [...current, parsed]);

          if (parsed.type === "error") {
            throw new Error(parsed.message);
          }

          if (parsed.type === "done" && isDemoResponse(parsed.data)) {
            setResult(parsed.data);
          }
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось создать сайт");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#1d1b18]">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl content-center gap-10 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="mb-5 font-mono text-sm uppercase tracking-[0.18em] text-[#7b6651]">revizor.ai</p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-6xl">
            Сайт локального бизнеса из реальных отзывов 2ГИС
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f574d]">
            Вставьте ссылку на карточку 2ГИС. Сервис соберет карточку, отзывы, фотографии гостей, поймет настроение
            и соберет страницу, которая говорит языком ваших клиентов.
          </p>

          <form onSubmit={submit} className="mt-10 flex max-w-3xl flex-col gap-3 rounded-lg border border-[#d6cbbd] bg-white p-3 shadow-sm">
            <input
              className="min-h-12 rounded-md border border-[#ded6cc] px-4 text-base outline-none transition focus:border-[#8b5e3c]"
              placeholder="https://go.2gis.com/..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
            <button
              className="min-h-12 rounded-md bg-[#1d1b18] px-6 font-medium text-white transition hover:bg-[#3a332b] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isRunning}
              type="submit"
            >
              {isRunning ? "Создаем сайт..." : "Создать сайт"}
            </button>
          </form>

          {error && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">{error}</div>}

          {result && (
            <div className="mt-6 rounded-lg border border-[#b9d2bc] bg-[#f2fbf3] p-5 text-[#1d321f]">
              <div className="font-medium">
                Готово: собрано {result.reviewsCount} отзывов{result.photoCount ? ` и ${result.photoCount} фото` : ""}.
              </div>
              {highlights.adjectives && <div className="mt-2">Поняли стиль: {highlights.adjectives}</div>}
              {highlights.mentions && <div className="mt-1">Главные темы: {highlights.mentions}</div>}
              <a className="mt-4 inline-flex rounded-md bg-[#1d1b18] px-5 py-3 font-medium text-white" href={result.publicPath}>
                Открыть предпросмотр
              </a>
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-[#d6cbbd] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#8b5e3c]">Процесс</p>
              <h2 className="mt-2 text-2xl font-semibold">Что сейчас делает бот</h2>
            </div>
            <div className="font-mono text-sm text-[#7b6651]">{Math.round(progressPercent)}%</div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#eee6dc]">
            <div className="h-full rounded-full bg-[#1d1b18] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {steps.map((step, index) => (
              <StepDot key={step.id} label={step.label} active={step.id === activeStep} done={Boolean(result) || index < activeIndex} />
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#d6cbbd] p-5 text-[#6d6257]">
                Здесь появятся живые шаги: ссылка, карточка места, отзывы, фотографии, анализ и сборка сайта.
              </div>
            ) : (
              events.map((item, index) => (
                <div key={`${item.step}-${index}`} className="rounded-lg border border-[#e4dacd] bg-[#fbfaf7] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{item.title}</h3>
                    {index === events.length - 1 && isRunning ? (
                      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#8b5e3c]" />
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#64594f]">{item.message}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
