import { after } from "next/server";
import { getVapiDeps } from "@/lib/api/deps";
import { withErrorBoundary } from "@/lib/api/http";
import { handleVapiWebhook } from "@/lib/api/vapi-webhook";

export const maxDuration = 60;

export const POST = withErrorBoundary((req: Request) =>
  handleVapiWebhook(
    req,
    getVapiDeps((task) => after(task)),
  ),
);
