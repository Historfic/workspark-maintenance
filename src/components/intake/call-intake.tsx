"use client";

import { PhoneDisconnectIcon, PhoneIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { useRetellCall } from "@/hooks/use-retell-call";
import { formatElapsed, type CallState } from "@/lib/voice/call-state";
import { MAX_CALL_SECONDS } from "@/lib/voice/constants";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY ?? "";
const AGENT_ID = process.env.NEXT_PUBLIC_RETELL_AGENT_ID ?? "";
const LIMIT = formatElapsed(MAX_CALL_SECONDS * 1000);

function statusText(state: CallState): string {
  switch (state.kind) {
    case "idle":
      return `Talk to the tenant-line agent in your browser. Calls end after ${MAX_CALL_SECONDS / 60} minutes.`;
    case "connecting":
      return "Connecting…";
    case "live":
      return "Call connected";
    case "ending":
      return "Ending call…";
    case "ended":
      return "Call ended. The ticket appears in the list within a few seconds.";
    case "error":
      return state.message;
  }
}

function buttonLabel(state: CallState): string {
  switch (state.kind) {
    case "connecting":
      return "Connecting…";
    case "ended":
      return "Call again";
    case "error":
      return "Try again";
    default:
      return "Call intake";
  }
}

function CallControls({ publicKey, agentId }: { publicKey: string; agentId: string }) {
  const { state, elapsedMs, start, hangUp } = useRetellCall(publicKey, agentId);
  const live = state.kind === "live";
  const connecting = state.kind === "connecting";
  const busy = connecting || state.kind === "ending";

  return (
    <div className="space-y-2">
      {live ? (
        <Button className="w-full" onClick={hangUp}>
          <PhoneDisconnectIcon size={18} aria-hidden />
          End call
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 aria-busy:cursor-progress"
            aria-busy={busy}
            onClick={busy ? undefined : start}
          >
            <PhoneIcon size={18} aria-hidden />
            {buttonLabel(state)}
          </Button>
          {connecting && (
            <Button variant="ghost" className="shrink-0" onClick={hangUp}>
              Cancel
            </Button>
          )}
        </div>
      )}
      <p className="flex items-start gap-2 text-xs text-ink-muted">
        {state.kind === "error" && <WarningCircleIcon size={16} aria-hidden className="shrink-0" />}
        <span role="status" className={live ? "sr-only" : undefined}>
          {statusText(state)}
        </span>
        {live && (
          <>
            <span aria-hidden className="flex items-center gap-2 text-ink">
              <span className="size-2.5 shrink-0 rounded-full bg-accent motion-safe:animate-pulse" />
              Live · speak now
            </span>
            <span className="ml-auto shrink-0 font-mono text-ink tabular-nums">
              {formatElapsed(elapsedMs)} / {LIMIT}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

export function CallIntake() {
  if (!PUBLIC_KEY || !AGENT_ID) return null;
  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="mb-2 text-xs text-ink-muted">Or call it in</p>
      <CallControls publicKey={PUBLIC_KEY} agentId={AGENT_ID} />
    </div>
  );
}
