import OpenAI from "openai";
import { optionalEnv } from "@/lib/env";
import type { AiProvider, GenerateObjectInput } from "./AiProvider";
import { extractJsonObject } from "./AiProvider";

export class LmStudioProvider implements AiProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      baseURL: optionalEnv("AI_BASE_URL", "http://localhost:1234/v1"),
      apiKey: optionalEnv("AI_API_KEY", "local")
    });
    this.model = optionalEnv("AI_MODEL", "local-model");
  }

  async generateObject<T>(input: GenerateObjectInput<T>): Promise<T> {
    let validationFeedback = "";
    const noThink = process.env.AI_DISABLE_THINKING === "true" ? "\n/no_think" : "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const completion = await this.client.chat.completions.create({
        model: input.model ?? this.model,
        temperature: input.temperature ?? 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: input.name,
            strict: true,
            schema: input.jsonSchema
          }
        },
        messages: [
          {
            role: "system",
            content: input.system
          },
          {
            role: "user",
            content: `${input.prompt}${validationFeedback}${noThink}`
          }
        ]
      });

      const content = completion.choices[0]?.message.content;
      if (!content) {
        throw new Error("AI provider returned empty response");
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
