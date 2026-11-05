import type { Status } from "@/lib/triage/schema";
import type { ReportDraft, TicketDraft } from "@/lib/triage/types";

export interface ReportRow extends ReportDraft {
  id: string;
  created_at: string;
}

export interface WorkOrderRow extends TicketDraft {
  id: string;
  report_id: string;
  status: Status;
  created_at: string;
  updated_at: string;
}
