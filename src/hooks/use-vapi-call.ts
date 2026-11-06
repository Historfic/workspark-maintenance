"use client";

import type Vapi from "@vapi-ai/web";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { callReducer, describeCallError, type CallState } from "@/lib/voice/call-state";

function ignoreStopFailure(): void {}

export function useVapiCall(publicKey: string, assistantId: string) {
  const [state, dispatch] = useReducer(callReducer, { kind: "idle" } satisfies CallState);
  const [now, setNow] = useState(0);
  const clientRef = useRef<Vapi | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (state.kind !== "live") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [state.kind]);

  const stopClient = useCallback(() => {
    clientRef.current?.stop().catch(ignoreStopFailure);
  }, []);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      stopClient();
    },
    [stopClient],
  );

  const connect = useCallback(async (): Promise<Vapi> => {
    if (clientRef.current) return clientRef.current;
    const { default: VapiClient } = await import("@vapi-ai/web");
    const client = new VapiClient(publicKey);
    client.on("call-start", () => dispatch({ type: "connected", at: Date.now() }));
    client.on("speech-start", () => dispatch({ type: "agent-speech", speaking: true }));
    client.on("speech-end", () => dispatch({ type: "agent-speech", speaking: false }));
    client.on("call-end", () => dispatch({ type: "ended" }));
    client.on("error", (error: unknown) =>
      dispatch({ type: "failed", message: describeCallError(error) }),
    );
    clientRef.current = client;
    return client;
  }, [publicKey]);

  const start = useCallback(() => {
    cancelledRef.current = false;
    dispatch({ type: "start" });
    connect()
      .then((client) => (cancelledRef.current ? null : client.start(assistantId)))
      .then((call) => {
        if (cancelledRef.current) {
          stopClient();
          dispatch({ type: "ended" });
        } else if (call === null) {
          dispatch({ type: "failed", message: describeCallError(undefined) });
        }
      })
      .catch((error: unknown) => dispatch({ type: "failed", message: describeCallError(error) }));
  }, [assistantId, connect, stopClient]);

  const hangUp = useCallback(() => {
    cancelledRef.current = true;
    dispatch({ type: "hang-up" });
    stopClient();
  }, [stopClient]);

  const elapsedMs = state.kind === "live" ? Math.max(0, now - state.startedAt) : 0;
  return { state, elapsedMs, start, hangUp };
}
