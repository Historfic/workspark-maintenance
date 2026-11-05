import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { EXTRACTION_JSON_SCHEMA, extractionSchema } from "./schema";
import { ExtractionError, type Extractor } from "./types";

export const DEFAULT_MODEL = "claude-fable-5-1";

const MODELS_WITH_SERVER_FALLBACK = new Set([
  "claude-fable-5-1",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5",
]);

function toExtractionError(error: unknown): unknown {
  if (error instanceof Anthropic.APIError) {
    return new ExtractionError(
      `Anthropic API error (${error.status ?? "network"}): ${error.message}`,
      "api",
    );
  }
  return error;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function createExtractor(client: Anthropic, model: string = DEFAULT_MODEL): Extractor {
  const fallback = MODELS_WITH_SERVER_FALLBACK.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};

  return async ({ text, source }) => {
    const started = performance.now();
    const response = await client.beta.messages
      .create(
        {
          model,
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          output_config: {
            effort: "low",
            format: { type: "json_schema", schema: EXTRACTION_JSON_SCHEMA },
          },
          messages: [{ role: "user", content: buildUserMessage(text, source) }],
          ...fallback,
        },
        { timeout: 45_000 },
      )
      .catch((error: unknown) => {
        throw toExtractionError(error);
      });
    const latencyMs = Math.round(performance.now() - started);

    if (response.stop_reason === "refusal") {
      throw new ExtractionError("Model declined the request", "refusal");
    }
    if (response.stop_reason === "max_tokens") {
      throw new ExtractionError("Model output was cut off", "truncated");
    }

    const reply = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    const parsed = extractionSchema.safeParse(parseJson(reply));
    if (!parsed.success) {
      throw new ExtractionError(
        `Model output failed validation: ${parsed.error.message}`,
        "invalid_output",
      );
    }
    return { output: parsed.data, model: response.model, latencyMs };
  };
}
