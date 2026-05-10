import { optionalEnv } from "@/lib/env";
import type { AiProvider, GenerateObjectInput } from "./AiProvider";
import { extractJsonObject } from "./AiProvider";

type OllamaResponse = {
  message?: {
    content?: string;
  };
};

export class OllamaProvider implements AiProvider {
  private baseUrl = optionalEnv("AI_BASE_URL", "http://localhost:11434");
  private model = optionalEnv("AI_MODEL", "qwen3:14b");

  async generateObject<T>(input: GenerateObjectInput<T>): Promise<T> {
    let validationFeedback = "";
    const noThink = process.env.AI_DISABLE_THINKING === "true" ? "\n/no_think" : "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: input.model ?? this.model,
          stream: false,
          format: input.jsonSchema,
          options: {
            temperature: input.temperature ?? 0.2
          },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: `${input.prompt}${validationFeedback}${noThink}` }
          ]
        })
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Ollama API failed: ${response.status} ${details}`);
      }

      const payload = (await response.json()) as OllamaResponse;
      const content = payload.message?.content;
      if (!content) {
        throw new Error("Ollama returned empty response");
      }

      const parsed = input.schema.safeParse(extractJsonObject(content));
      if (parsed.success) {
        return parsed.data;
      }

      validationFeedback = `\n\nPrevious JSON failed validation. Return corrected JSON only. Validation errors: ${parsed.error.message}`;
    }

    throw new Error("AI JSON validation failed after retry");
  }
}
