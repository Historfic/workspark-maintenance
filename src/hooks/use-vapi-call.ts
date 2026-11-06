"use client";

import type Vapi from "@vapi-ai/web";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { callReducer, describeCallError, type CallState } from "@/lib/voice/call-state";

export function useVapiCall(publicKey: string, assistantId: string) {
  const [state, dispatch] = useReducer(callReducer, { kind: "idle" } satisfies CallState);
  const [now, setNow] = useState(0);
  const clientRef = useRef<Vapi | null>(null);

  useEffect(() => {
    if (state.kind !== "live") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [state.kind]);

  useEffect(() => () => void clientRef.current?.stop(), []);

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
    dispatch({ type: "start" });
    connect()
      .then((client) => client.start(assistantId))
      .catch((error: unknown) => dispatch({ type: "failed", message: describeCallError(error) }));
  }, [assistantId, connect]);

  const hangUp = useCallback(() => {
    dispatch({ type: "hang-up" });
    void clientRef.current?.stop();
  }, []);

  const elapsedMs = state.kind === "live" ? Math.max(0, now - state.startedAt) : 0;
  return { state, elapsedMs, start, hangUp };
}
