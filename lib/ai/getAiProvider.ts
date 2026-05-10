import type { AiProvider, AiProviderName } from "./AiProvider";
import { LmStudioProvider } from "./LmStudioProvider";
import { OllamaProvider } from "./OllamaProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";

export function getAiProvider(providerOverride?: string): AiProvider {
  const provider = normalizeAiProvider(providerOverride ?? process.env.AI_PROVIDER ?? "lmstudio");

  if (provider === "ollama") {
    return new OllamaProvider();
  }

  if (provider === "openrouter") {
    return new OpenRouterProvider();
  }

  return new LmStudioProvider();
}

function normalizeAiProvider(provider: string): AiProviderName {
  if (provider === "ollama" || provider === "openrouter" || provider === "lmstudio") {
    return provider;
  }

  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}
