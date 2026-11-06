"use client";

import { useEffect, useReducer, type Dispatch } from "react";
import { getBrowserClient } from "@/lib/db/browser-client";
import { parseWorkOrderRow } from "@/lib/db/row-schemas";
import type { WorkOrderRow } from "@/lib/db/types";
import {
  feedReducer,
  initialFeedState,
  type FeedAction,
  type FeedState,
} from "@/lib/dashboard/feed-reducer";

const RECENT_MS = 1500;

export function useWorkOrdersFeed(initial: WorkOrderRow[]): {
  state: FeedState;
  dispatch: Dispatch<FeedAction>;
} {
  const [state, dispatch] = useReducer(feedReducer, initial, initialFeedState);

  useEffect(() => {
    const client = getBrowserClient();
    const channel = client
      .channel("work_orders_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "work_orders" },
        (payload) => {
          const row = parseWorkOrderRow(payload.new);
          if (row) dispatch({ type: "upsert", row, fromRealtime: true });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "work_orders" },
        (payload) => {
          const row = parseWorkOrderRow(payload.new);
          if (row) dispatch({ type: "upsert", row, fromRealtime: true });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") dispatch({ type: "connection", value: "live" });
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          dispatch({ type: "connection", value: "reconnecting" });
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (state.recentIds.length === 0) return;
    const timers = state.recentIds.map((id) =>
      setTimeout(() => dispatch({ type: "clearRecent", id }), RECENT_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [state.recentIds]);

  return { state, dispatch };
}
