import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createServerStore } from "@/lib/db/server-store";
import { requireEnv } from "@/lib/env";
import { createExtractor, DEFAULT_MODEL } from "@/lib/triage/extract";
import { MAX_REPORT_CHARS, normalizeReportText } from "@/lib/triage/normalize";
import { runTriage } from "@/lib/triage/pipeline";
import type { Status } from "@/lib/triage/schema";

// Demo seed for the dashboard. Each report goes through the real model and pipeline, so every
// ticket's audit trail is genuine. Only two things are staged for the demo: created_at is spread
// over the last few days so relative times read like a working week, and some tickets are moved
// along the New → In Progress → Done workflow. Re-running skips reports that already exist.

interface DemoReport {
  text: string;
  hoursAgo: number;
  statuses?: readonly Status[];
}

const DEMO_REPORTS: readonly DemoReport[] = [
  {
    text: "Hi, this is 3A. One of the kitchen cabinet doors is hanging off its hinge. No rush.",
    hoursAgo: 70,
    statuses: ["Done"],
  },
  {
    text: "Unit 10A. The outlet next to my bed stopped working. Everything else in the apartment has power.",
    hoursAgo: 64,
    statuses: ["Done"],
  },
  {
    text: "This is 6A. We've had no hot water since this morning and the water heater keeps clicking.",
    hoursAgo: 52,
    statuses: ["In Progress"],
  },
  {
    text: "Saw a mouse run across the pantry floor in 9A last night, and there are droppings behind the fridge.",
    hoursAgo: 47,
    statuses: ["Done"],
  },
  {
    text: "Unit 11D, the fridge stopped cooling overnight and the food is starting to spoil.",
    hoursAgo: 40,
    statuses: ["In Progress"],
  },
  {
    text: "The elevator on the east side keeps stopping between the fourth and fifth floor. It happened to me twice today.",
    hoursAgo: 33,
  },
  {
    text: "This is 8E. My front door lock won't latch anymore, the door just swings open.",
    hoursAgo: 28,
  },
  {
    text: "Unit 5D here. The shower drains really slowly, and there are ants coming in under the kitchen window.",
    hoursAgo: 22,
    statuses: ["In Progress", "New"],
  },
  {
    text: "4F here, probably nothing, but there was a spark and a burning smell when I plugged the kettle into the outlet behind the microwave.",
    hoursAgo: 15,
  },
  {
    text: "Water is pouring through the ceiling light in my kitchen! This is 5B.",
    hoursAgo: 9,
  },
  {
    text: "Our carbon monoxide alarm keeps going off in 9C. We opened the windows and went outside.",
    hoursAgo: 6,
    statuses: ["In Progress"],
  },
  {
    text: "Hey, someone's AC upstairs is dripping onto my balcony. It's been going all day.",
    hoursAgo: 4,
  },
  {
    text: "Unit 12B, there's a small crack in the paint along the hallway ceiling. Just letting you know.",
    hoursAgo: 2,
  },
  {
    text: "This is 2C, the toilet won't stop running and now there's water on the bathroom floor.",
    hoursAgo: 0.5,
  },
];

async function check(query: PromiseLike<{ error: { message: string } | null }>, label: string) {
  const { error } = await query;
  if (error) throw new Error(`${label} failed: ${error.message}`);
}

async function main(): Promise<void> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  const db = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const store = createServerStore(url, secretKey);
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const extract = createExtractor(
    new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") }),
    model,
  );

  const existing = await db.from("reports").select("raw_text");
  if (existing.error) throw new Error(`Could not read existing reports: ${existing.error.message}`);
  const rows: Array<{ raw_text: string }> = existing.data ?? [];
  const seeded = new Set(rows.map((row) => row.raw_text));

  let created = 0;
  for (const demo of DEMO_REPORTS) {
    const normalized = normalizeReportText(demo.text, MAX_REPORT_CHARS);
    if (!normalized.ok) throw new Error(`Demo report is not valid input: ${demo.text}`);
    if (seeded.has(normalized.text)) {
      console.log(`skip   ${normalized.text.slice(0, 70)}`);
      continue;
    }

    const result = await runTriage(
      { text: normalized.text, source: "text", callerLast4: null, vapiCallId: null },
      extract,
    );
    const saved = await store.saveTriage(result);
    if (!saved) throw new Error(`Saving returned nothing for: ${normalized.text}`);

    const createdAt = new Date(Date.now() - demo.hoursAgo * 3_600_000).toISOString();
    await check(
      db.from("reports").update({ created_at: createdAt }).eq("id", saved.report.id),
      "Backdating the report",
    );
    for (const order of saved.workOrders) {
      const status = demo.statuses?.[order.position] ?? "New";
      await check(
        db.from("work_orders").update({ created_at: createdAt, status }).eq("id", order.id),
        "Backdating a work order",
      );
    }

    created += 1;
    const tickets = saved.workOrders
      .map(
        (order) =>
          `${order.priority} ${order.issue_type} ${order.unit ?? "unit?"} (${order.priority_source})`,
      )
      .join(" + ");
    console.log(`added  ${tickets}`);
  }

  console.log(
    `\n${created} report(s) added with model ${model}; ${DEMO_REPORTS.length - created} already present.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
