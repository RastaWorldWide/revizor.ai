import type { z } from "zod";

export type GenerateObjectInput<T> = {
  name: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  temperature?: number;
};

export interface AiProvider {
  generateObject<T>(input: GenerateObjectInput<T>): Promise<T>;
}

export function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("AI response did not contain JSON object");
  }

  return JSON.parse(match[0]);
}
