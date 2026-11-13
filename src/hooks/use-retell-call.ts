"use client";

import type { RetellClient, WebCallSession } from "retell-client-js-sdk";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { callReducer, describeCallError, type CallState } from "@/lib/voice/call-state";

function ignoreEndFailure(): void {}

export function useRetellCall(publicKey: string, agentId: string) {
  const [state, dispatch] = useReducer(callReducer, { kind: "idle" } satisfies CallState);
  const [now, setNow] = useState(0);
  const clientRef = useRef<RetellClient | null>(null);
  const sessionRef = useRef<WebCallSession | null>(null);

  // The SDK is loaded ahead of the click so starting the call happens inside the user's gesture,
  // which the browser needs for the microphone prompt and audio playback.
  useEffect(() => {
    let cancelled = false;
    void import("retell-client-js-sdk").then(({ RetellClient: Client }) => {
      if (!cancelled) clientRef.current = new Client({ key: publicKey });
    });
    return () => {
      cancelled = true;
      sessionRef.current?.end().catch(ignoreEndFailure);
    };
  }, [publicKey]);

  useEffect(() => {
    if (state.kind !== "live") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [state.kind]);

  const start = useCallback(() => {
    const client = clientRef.current;
    dispatch({ type: "start" });
    if (!client) {
      dispatch({ type: "failed", message: describeCallError(undefined) });
      return;
    }
    const session = client.createWebCall({
      agent_id: agentId,
      hooks: {
        onStatus: (status) => {
          if (status === "live") dispatch({ type: "connected", at: Date.now() });
          if (status === "ended") dispatch({ type: "ended" });
        },
        onError: (error) => dispatch({ type: "failed", message: describeCallError(error) }),
      },
    });
    sessionRef.current = session;
    session.ready.catch(ignoreEndFailure);
  }, [agentId]);

  const hangUp = useCallback(() => {
    dispatch({ type: "hang-up" });
    sessionRef.current?.end().catch(ignoreEndFailure);
  }, []);

  const elapsedMs = state.kind === "live" ? Math.max(0, now - state.startedAt) : 0;
  return { state, elapsedMs, start, hangUp };
}
