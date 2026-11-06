import { getDeps } from "@/lib/api/deps";
import { withErrorBoundary } from "@/lib/api/http";
import { handleUpdateStatus } from "@/lib/api/update-status";

export const PATCH = withErrorBoundary(
  async (req: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    return handleUpdateStatus(req, id, getDeps().store);
  },
);
