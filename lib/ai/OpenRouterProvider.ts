import OpenAI from "openai";
import { optionalEnv } from "@/lib/env";
import type { AiProvider, GenerateObjectInput } from "./AiProvider";
import { extractJsonObject } from "./AiProvider";
import { isAutoFreeModel, resolveOpenRouterFreeModels } from "./OpenRouterFreeModelResolver";

type JsonMode = "schema" | "json_object" | "prompt";

function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY;

  if (!apiKey || apiKey === "local") {
    throw new Error("Missing OpenRouter API key. Set OPENROUTER_API_KEY or AI_API_KEY in your env.");
  }

  return apiKey;
}

export class OpenRouterProvider implements AiProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      baseURL: optionalEnv("AI_BASE_URL", "https://openrouter.ai/api/v1"),
      apiKey: getOpenRouterApiKey(),
      defaultHeaders: {
        "HTTP-Referer": optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
        "X-Title": optionalEnv("OPENROUTER_APP_NAME", "revizor.ai")
      }
    });
    this.model = optionalEnv("AI_MODEL", "openai/gpt-4o-mini");
  }

  async generateObject<T>(input: GenerateObjectInput<T>): Promise<T> {
    let validationFeedback = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const completion = await this.createCompletion(input, validationFeedback);

      const content = completion.choices[0]?.message.content;
      if (!content) {
        throw new Error("OpenRouter returned empty response");
      }

      const parsed = input.schema.safeParse(extractJsonObject(content));
      if (parsed.success) {
        return parsed.data;
      }

      validationFeedback = `\n\nPrevious JSON failed validation. Return corrected JSON only. Validation errors: ${parsed.error.message}`;
    }

    throw new Error("AI JSON validation failed after retry");
  }

  private async createCompletion<T>(input: GenerateObjectInput<T>, validationFeedback: string) {
    const requestedModel = input.model ?? this.model;
    const candidateModels = isAutoFreeModel(requestedModel)
      ? (await resolveOpenRouterFreeModels()).slice(0, Number(process.env.OPENROUTER_MAX_AUTO_FREE_MODELS) || 2)
      : [requestedModel];
    const requestedMode = process.env.OPENROUTER_JSON_MODE;
    const modes: JsonMode[] =
      requestedMode === "json_object" || requestedMode === "prompt" || requestedMode === "schema"
        ? [requestedMode]
        : ["schema", "json_object", "prompt"];

    let lastError: unknown;

    for (const model of candidateModels) {
      for (const mode of modes) {
        try {
          return await this.client.chat.completions.create({
            model,
            temperature: input.temperature ?? 0.2,
            response_format: this.getResponseFormat(mode, input),
            messages: [
              {
                role: "system",
                content: input.system
              },
              {
                role: "user",
                content: `${input.prompt}${this.getFallbackSchemaPrompt(mode, input)}${validationFeedback}`
              }
            ]
          },
          {
            timeout: Number(process.env.OPENROUTER_REQUEST_TIMEOUT_MS) || Number(process.env.AI_REQUEST_TIMEOUT_MS) || 15000
          });
        } catch (error) {
          lastError = error;
          if (isJsonModeCapabilityError(error)) {
            continue;
          }

          if (candidateModels.length > 1 && isModelAvailabilityError(error)) {
            break;
          }

          throw error;
        }
      }
    }

    throw lastError;
  }

  private getResponseFormat<T>(mode: JsonMode, input: GenerateObjectInput<T>) {
    if (mode === "schema") {
      return {
        type: "json_schema" as const,
        json_schema: {
          name: input.name,
          strict: true,
          schema: input.jsonSchema
        }
      };
    }

    if (mode === "json_object") {
      return {
        type: "json_object" as const
      };
    }

    return undefined;
  }

  private getFallbackSchemaPrompt<T>(mode: JsonMode, input: GenerateObjectInput<T>): string {
    if (mode === "schema") {
      return "";
    }

    return `\n\nReturn only a valid JSON object matching this JSON Schema:\n${JSON.stringify(input.jsonSchema)}`;
  }
}

function isJsonModeCapabilityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /response_format|json_schema|json_object|structured|schema/i.test(message);
}

function isModelAvailabilityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate.?limit|timeout|timed out|temporarily|unavailable|overloaded|provider returned error/i.test(message);
}
