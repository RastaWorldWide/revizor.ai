import { optionalEnv } from "@/lib/env";

const DEFAULT_FREE_MODELS_URL = "https://shir-man.com/api/free-llm/top-models";
const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_FALLBACK_MODEL = "openrouter/free";

type FreeModelApiModel = {
  id?: unknown;
  rank?: unknown;
  score?: unknown;
  supportsStructuredOutputs?: unknown;
  supportsResponseFormat?: unknown;
};

type FreeModelApiResponse = {
  models?: unknown;
  fallback?: {
    id?: unknown;
  };
};

type RankedFreeModel = {
  id: string;
  rank: number;
  score: number;
  supportsStructuredOutputs: boolean;
  supportsResponseFormat: boolean;
};

export function isAutoFreeModel(model: string | undefined): boolean {
  return model === "auto-free" || model === "best-free" || model === "openrouter/best-free";
}

export async function resolveOpenRouterFreeModels(): Promise<string[]> {
  const url = optionalEnv("OPENROUTER_FREE_MODELS_URL", DEFAULT_FREE_MODELS_URL);
  const timeoutMs = Number(process.env.OPENROUTER_FREE_MODELS_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const fallbackModel = optionalEnv("OPENROUTER_FREE_MODEL_FALLBACK", DEFAULT_FALLBACK_MODEL);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Free OpenRouter model ranking failed: ${response.status}`);
    }

    const payload = (await response.json()) as FreeModelApiResponse;
    return buildCandidateList(payload, fallbackModel);
  } catch {
    return [fallbackModel];
  } finally {
    clearTimeout(timeout);
  }
}

function buildCandidateList(payload: FreeModelApiResponse, fallbackModel: string): string[] {
  const models = Array.isArray(payload.models) ? payload.models.map(normalizeModel).filter(isRankedFreeModel) : [];
  const jsonCapable = models.filter((model) => model.supportsStructuredOutputs || model.supportsResponseFormat);
  const rankedModels = (jsonCapable.length > 0 ? jsonCapable : models).sort(compareModels);
  const fallback = typeof payload.fallback?.id === "string" ? payload.fallback.id : fallbackModel;

  return unique([...rankedModels.map((model) => model.id), fallback, fallbackModel]);
}

function normalizeModel(value: unknown): RankedFreeModel | null {
  const model = value as FreeModelApiModel;

  if (!model || typeof model.id !== "string") {
    return null;
  }

  return {
    id: model.id,
    rank: typeof model.rank === "number" ? model.rank : Number.MAX_SAFE_INTEGER,
    score: typeof model.score === "number" ? model.score : 0,
    supportsStructuredOutputs: model.supportsStructuredOutputs === true,
    supportsResponseFormat: model.supportsResponseFormat === true
  };
}

function isRankedFreeModel(value: RankedFreeModel | null): value is RankedFreeModel {
  return value !== null;
}

function compareModels(a: RankedFreeModel, b: RankedFreeModel) {
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }

  return b.score - a.score;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
