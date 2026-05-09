import type { AiProvider } from "./AiProvider";
import { LmStudioProvider } from "./LmStudioProvider";
import { OllamaProvider } from "./OllamaProvider";

export function getAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER ?? "lmstudio";

  if (provider === "ollama") {
    return new OllamaProvider();
  }

  return new LmStudioProvider();
}
