import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { requireEnv } from "@/lib/env";
import { checkSample, renderResultsTable, type SampleOutcome } from "@/lib/triage/eval-check";
import { createExtractor, DEFAULT_MODEL } from "@/lib/triage/extract";
import { runTriage } from "@/lib/triage/pipeline";
import { PROMPT_VERSION } from "@/lib/triage/prompt";
import { SAMPLE_REPORTS } from "@/lib/triage/samples";

const WALKTHROUGH = fileURLToPath(new URL("../docs/walkthrough.md", import.meta.url));
const START = "<!-- eval:start -->";
const END = "<!-- eval:end -->";

async function writeResults(content: string): Promise<void> {
  const doc = await readFile(WALKTHROUGH, "utf8");
  const start = doc.indexOf(START);
  const end = doc.indexOf(END);
  if (start === -1 || end === -1) throw new Error(`docs/walkthrough.md needs ${START} and ${END}`);
  await writeFile(
    WALKTHROUGH,
    `${doc.slice(0, start + START.length)}\n${content}\n${doc.slice(end)}`,
  );
}

async function main(): Promise<void> {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const extract = createExtractor(
    new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") }),
    model,
  );

  const outcomes: SampleOutcome[] = [];
  for (const sample of SAMPLE_REPORTS) {
    const result = await runTriage(
      { text: sample.text, source: "text", callerLast4: null, vapiCallId: null },
      extract,
    );
    const failures = checkSample(sample, result);
    outcomes.push({ sample, result, failures });
    console.log(
      `${failures.length === 0 ? "PASS" : "FAIL"}  ${sample.label}  ${failures.join("; ")}`,
    );
  }

  const ranAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  await writeResults(
    `Model \`${model}\`, prompt \`${PROMPT_VERSION}\`, run ${ranAt} UTC.\n\n${renderResultsTable(outcomes)}`,
  );

  const failed = outcomes.filter((outcome) => outcome.failures.length > 0).length;
  console.log(
    failed === 0 ? "\nAll five sample reports pass." : `\n${failed} sample report(s) failed.`,
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
