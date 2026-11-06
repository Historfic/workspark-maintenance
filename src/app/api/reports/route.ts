import { handleCreateReport } from "@/lib/api/create-report";
import { getDeps } from "@/lib/api/deps";
import { withErrorBoundary } from "@/lib/api/http";

export const maxDuration = 60;

export const POST = withErrorBoundary((req: Request) => handleCreateReport(req, getDeps()));
