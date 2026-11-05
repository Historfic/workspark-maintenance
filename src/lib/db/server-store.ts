import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Status } from "@/lib/triage/schema";
import type { TriageResult } from "@/lib/triage/types";
import { StoreError, type SavedTriage, type TriageStore } from "./store";
import type { ReportRow, WorkOrderRow } from "./types";

export function createServerStore(url: string, secretKey: string): TriageStore {
  const db = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async saveTriage({ report, tickets }: TriageResult): Promise<SavedTriage | null> {
      const saved = await db.rpc("create_report_with_work_orders", {
        p_report: report,
        p_orders: tickets,
      });
      if (saved.error) throw new StoreError("save triage", saved.error);
      if (typeof saved.data !== "string") return null;

      const [reportResult, ordersResult] = await Promise.all([
        db.from("reports").select("*").eq("id", saved.data).single(),
        db.from("work_orders").select("*").eq("report_id", saved.data).order("position"),
      ]);
      if (reportResult.error) throw new StoreError("read report", reportResult.error);
      if (ordersResult.error) throw new StoreError("read work orders", ordersResult.error);
      const reportRow: ReportRow = reportResult.data;
      const workOrders: WorkOrderRow[] = ordersResult.data;
      return { report: reportRow, workOrders };
    },

    async allowIntake(ipHash: string, maxPerMinute: number): Promise<boolean> {
      const { data, error } = await db.rpc("check_intake_rate", {
        p_ip_hash: ipHash,
        p_max_per_minute: maxPerMinute,
      });
      if (error) throw new StoreError("check rate limit", error);
      return data === true;
    },

    async updateStatus(id: string, status: Status): Promise<WorkOrderRow | null> {
      const { data, error } = await db
        .from("work_orders")
        .update({ status })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new StoreError("update status", error);
      const row: WorkOrderRow | null = data;
      return row;
    },
  };
}
