import type { WorkOrderRow } from "@/lib/db/types";
import type { Status } from "@/lib/triage/schema";
import { sortWorkOrders } from "./ordering";

export type Connection = "connecting" | "live" | "reconnecting";

export interface FeedState {
  orders: WorkOrderRow[];
  recentIds: string[];
  announcement: string | null;
  connection: Connection;
}

export type FeedAction =
  | { type: "upsert"; row: WorkOrderRow; fromRealtime: boolean }
  | { type: "setStatus"; id: string; status: Status }
  | { type: "replace"; rows: WorkOrderRow[] }
  | { type: "connection"; value: Connection }
  | { type: "clearRecent"; id: string };

export function initialFeedState(rows: readonly WorkOrderRow[]): FeedState {
  return {
    orders: sortWorkOrders(rows),
    recentIds: [],
    announcement: null,
    connection: "connecting",
  };
}

export function announceFor(row: WorkOrderRow): string {
  return `New ${row.priority} ticket: ${row.issue_type}, ${row.unit ? `unit ${row.unit}` : "unit unknown"}`;
}

export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "upsert": {
      const exists = state.orders.some((row) => row.id === action.row.id);
      const orders = sortWorkOrders(
        exists
          ? state.orders.map((row) => (row.id === action.row.id ? action.row : row))
          : [...state.orders, action.row],
      );
      const isNew = !exists && action.fromRealtime;
      return {
        ...state,
        orders,
        recentIds: isNew ? [...state.recentIds, action.row.id] : state.recentIds,
        announcement: isNew ? announceFor(action.row) : null,
      };
    }
    case "setStatus":
      return {
        ...state,
        orders: state.orders.map((row) =>
          row.id === action.id ? { ...row, status: action.status } : row,
        ),
      };
    case "replace":
      return { ...state, orders: sortWorkOrders(action.rows) };
    case "connection":
      return { ...state, connection: action.value };
    case "clearRecent":
      return { ...state, recentIds: state.recentIds.filter((id) => id !== action.id) };
  }
}
