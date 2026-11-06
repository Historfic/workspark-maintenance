export type CallState =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "live"; startedAt: number; agentSpeaking: boolean }
  | { kind: "ending" }
  | { kind: "ended" }
  | { kind: "error"; message: string };

export type CallEvent =
  | { type: "start" }
  | { type: "connected"; at: number }
  | { type: "agent-speech"; speaking: boolean }
  | { type: "hang-up" }
  | { type: "ended" }
  | { type: "failed"; message: string };

const MIC_BLOCKED =
  "Microphone access is blocked. Allow it for this site in the browser, then try again.";
const CALL_FAILED = "The call could not connect. Try again, or dial the number below.";
const MAX_ERROR_DEPTH = 3;

export function callReducer(state: CallState, event: CallEvent): CallState {
  switch (event.type) {
    case "start":
      return state.kind === "connecting" || state.kind === "live" ? state : { kind: "connecting" };
    case "connected":
      return state.kind === "connecting"
        ? { kind: "live", startedAt: event.at, agentSpeaking: false }
        : state;
    case "agent-speech":
      return state.kind === "live" ? { ...state, agentSpeaking: event.speaking } : state;
    case "hang-up":
      return state.kind === "live" || state.kind === "connecting" ? { kind: "ending" } : state;
    case "ended":
      return state.kind === "error" ? state : { kind: "ended" };
    case "failed":
      return { kind: "error", message: event.message };
  }
}

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function errorText(error: unknown, depth = 0): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error !== "object" || error === null) return String(error);
  if (depth >= MAX_ERROR_DEPTH) return "";
  return Object.values(error)
    .map((value: unknown) => errorText(value, depth + 1))
    .join(" ");
}

export function describeCallError(error: unknown): string {
  return /NotAllowed|permission/i.test(errorText(error)) ? MIC_BLOCKED : CALL_FAILED;
}
