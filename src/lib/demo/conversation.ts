import type { IssueType, Priority, Source } from "@/lib/triage/schema";

export interface ConversationLine {
  speaker: "tenant" | "agent";
  text: string;
  simulated: boolean;
}

interface ReplyTicket {
  id: string;
  priority: Priority;
  issue_type: IssueType;
  unit: string | null;
}

const SPEAKER = /^(Caller|User|Tenant|Agent):\s*/i;

function transcriptLines(transcript: string): ConversationLine[] {
  const lines: ConversationLine[] = [];
  for (const raw of transcript.split("\n")) {
    const match = SPEAKER.exec(raw);
    const last = lines.at(-1);
    if (match) {
      const speaker = match[1]?.toLowerCase() === "agent" ? "agent" : "tenant";
      lines.push({ speaker, text: raw.slice(match[0].length).trim(), simulated: false });
    } else if (last && raw.trim()) {
      last.text = `${last.text}\n${raw.trim()}`;
    }
  }
  return lines;
}

export function conversationLines(
  report: { source: Source; raw_text: string },
  simulatedReply: string | null,
): ConversationLine[] {
  if (report.source !== "text") return transcriptLines(report.raw_text);
  const lines: ConversationLine[] = [
    { speaker: "tenant", text: report.raw_text, simulated: false },
  ];
  if (simulatedReply) lines.push({ speaker: "agent", text: simulatedReply, simulated: true });
  return lines;
}

export function agentReply(
  tickets: readonly ReplyTicket[],
  tenantName: string | null,
  ticketNumber: (id: string) => string,
): string {
  const firstName = tenantName?.split(" ")[0];
  const parts = [firstName ? `Thanks, ${firstName}.` : "Thanks for letting us know."];
  const numbers = tickets.map((t) => `${ticketNumber(t.id)} (${t.issue_type})`);
  parts.push(
    numbers.length === 1
      ? `I've created ticket ${numbers[0]}.`
      : `I've created ${numbers.length} tickets: ${numbers.join(", ")}.`,
  );
  if (tickets.some((t) => t.priority === "Emergency")) {
    parts.push("This is an emergency, so I'm calling the on-call super right now.");
  }
  if (tickets.some((t) => t.unit === null)) {
    parts.push("Which unit are you in, so I can match you in Rent Manager?");
  } else if (tickets.every((t) => t.priority !== "Emergency")) {
    parts.push("When are you available this week, and may the super enter if you're out?");
  }
  return parts.join(" ");
}
