import { after } from "next/server";
import { getRetellDeps } from "@/lib/api/deps";
import { withErrorBoundary } from "@/lib/api/http";
import { handleRetellWebhook } from "@/lib/api/retell-webhook";

export const maxDuration = 60;

export const POST = withErrorBoundary((req: Request) =>
  handleRetellWebhook(
    req,
    getRetellDeps((task) => after(task)),
  ),
);
