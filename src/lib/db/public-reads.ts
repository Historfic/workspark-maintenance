import type { SupabaseClient } from "@supabase/supabase-js";
import { parseWorkOrderRow, reportRowSchema } from "./row-schemas";
import type { ReportRow, WorkOrderRow } from "./types";

function parseRows(data: unknown): WorkOrderRow[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const row = parseWorkOrderRow(item);
    return row ? [row] : [];
  });
}

export async function listWorkOrders(client: SupabaseClient, limit = 200): Promise<WorkOrderRow[]> {
  const { data, error } = await client
    .from("work_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load work orders: ${error.message}`);
  return parseRows(data);
}

export async function fetchReportBundle(
  client: SupabaseClient,
  reportId: string,
): Promise<{ report: ReportRow; siblings: WorkOrderRow[] } | null> {
  const [reportResult, siblingResult] = await Promise.all([
    client.from("reports").select("*").eq("id", reportId).maybeSingle(),
    client.from("work_orders").select("*").eq("report_id", reportId).order("position"),
  ]);
  if (reportResult.error)
    throw new Error(`Could not load the report: ${reportResult.error.message}`);
  if (siblingResult.error)
    throw new Error(`Could not load related tickets: ${siblingResult.error.message}`);
  const report = reportRowSchema.safeParse(reportResult.data);
  if (!report.success) return null;
  return { report: report.data, siblings: parseRows(siblingResult.data) };
}
