import { z } from "zod";
import type { TriageStore } from "@/lib/db/store";
import { STATUSES } from "@/lib/triage/schema";
import { errorResponse, readJson } from "./http";

const idSchema = z.uuid();
const bodySchema = z.object({ status: z.enum(STATUSES) });

export async function handleUpdateStatus(
  req: Request,
  id: string,
  store: Pick<TriageStore, "updateStatus">,
): Promise<Response> {
  if (!idSchema.safeParse(id).success)
    return errorResponse("not_found", "No work order with that id.");

  const body = bodySchema.safeParse(await readJson(req));
  if (!body.success) {
    return errorResponse("invalid_input", `Status must be one of: ${STATUSES.join(", ")}.`);
  }

  const updated = await store.updateStatus(id, body.data.status);
  if (!updated) return errorResponse("not_found", "No work order with that id.");
  return Response.json({ work_order: updated });
}
