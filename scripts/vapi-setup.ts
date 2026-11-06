import { z } from "zod";
import { SECRET_HEADER } from "@/lib/api/vapi-webhook";
import { requireEnv } from "@/lib/env";
import {
  buildAssistantConfig,
  CREDENTIAL_NAME,
  isOwnAssistant,
  isOwnCredential,
  isOwnPhoneNumber,
  PHONE_NAME,
} from "@/lib/vapi/assistant-config";

const API = "https://api.vapi.ai";
const WEBHOOK_PATH = "/api/webhooks/vapi";
const SECRET_ENV_KEYS = ["VAPI_WEBHOOK_SECRET", "VAPI_PRIVATE_KEY"];
const idSchema = z.object({ id: z.string().min(1) });
const phoneSchema = z.object({
  id: z.string().min(1),
  number: z.string().optional(),
  status: z.string().optional(),
});

function redactSecrets(text: string): string {
  return SECRET_ENV_KEYS.reduce((redacted, key) => {
    const secret = process.env[key];
    return secret ? redacted.split(secret).join("[redacted]") : redacted;
  }, text);
}

async function vapi(path: string, init: { method: string; body?: unknown }): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${requireEnv("VAPI_PRIVATE_KEY")}`,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${init.method} ${path} answered ${response.status}: ${redactSecrets(text).slice(0, 300)}`,
    );
  }
  const data: unknown = text ? JSON.parse(text) : null;
  return data;
}

function serverUrlArg(): string {
  const index = process.argv.indexOf("--server-url");
  const raw = index === -1 ? undefined : process.argv[index + 1];
  const url = raw === undefined ? null : URL.parse(raw);
  if (url?.protocol !== "https:" || url.pathname !== WEBHOOK_PATH) {
    throw new Error(
      `Pass --server-url https://<host>${WEBHOOK_PATH} (Vapi needs a public https URL).`,
    );
  }
  return url.href;
}

async function syncCredential(): Promise<string> {
  const authenticationPlan = {
    type: "bearer",
    token: requireEnv("VAPI_WEBHOOK_SECRET"),
    headerName: SECRET_HEADER,
    bearerPrefixEnabled: false,
  };
  const existing = process.env.VAPI_CREDENTIAL_ID;
  if (existing) {
    const current = await vapi(`/credential/${existing}`, { method: "GET" });
    if (!isOwnCredential(current)) {
      throw new Error(
        `Credential ${existing} is not this app's webhook credential. Refusing to change it.`,
      );
    }
    await vapi(`/credential/${existing}`, { method: "PATCH", body: { authenticationPlan } });
    return existing;
  }
  const created = idSchema.parse(
    await vapi("/credential", {
      method: "POST",
      body: { provider: "webhook", name: CREDENTIAL_NAME, authenticationPlan },
    }),
  );
  return created.id;
}

async function syncAssistant(serverUrl: string, credentialId: string): Promise<string> {
  const config = buildAssistantConfig({ serverUrl, credentialId });
  const existing = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
  if (existing) {
    const current = await vapi(`/assistant/${existing}`, { method: "GET" });
    if (!isOwnAssistant(current)) {
      throw new Error(`Assistant ${existing} is not this app's assistant. Refusing to change it.`);
    }
    await vapi(`/assistant/${existing}`, { method: "PATCH", body: config });
    return existing;
  }
  return idSchema.parse(await vapi("/assistant", { method: "POST", body: config })).id;
}

async function syncPhoneNumber(assistantId: string): Promise<z.infer<typeof phoneSchema>> {
  const existing = process.env.VAPI_PHONE_NUMBER_ID;
  if (existing) {
    const current = await vapi(`/phone-number/${existing}`, { method: "GET" });
    if (!isOwnPhoneNumber(current)) {
      throw new Error(`Phone number ${existing} is not this app's number. Refusing to change it.`);
    }
    return phoneSchema.parse(
      await vapi(`/phone-number/${existing}`, { method: "PATCH", body: { assistantId } }),
    );
  }
  return phoneSchema.parse(
    await vapi("/phone-number", {
      method: "POST",
      body: { provider: "vapi", name: PHONE_NAME, assistantId },
    }),
  );
}

async function main(): Promise<void> {
  const serverUrl = serverUrlArg();
  const credentialId = await syncCredential();
  const assistantId = await syncAssistant(serverUrl, credentialId);
  const phone = await syncPhoneNumber(assistantId);

  console.log("Add or update these lines in .env.local (IDs only, no secrets):\n");
  console.log(`VAPI_CREDENTIAL_ID=${credentialId}`);
  console.log(`NEXT_PUBLIC_VAPI_ASSISTANT_ID=${assistantId}`);
  console.log(`VAPI_PHONE_NUMBER_ID=${phone.id}`);
  console.log(`NEXT_PUBLIC_VAPI_PHONE_NUMBER=${phone.number ?? ""}`);
  if (!phone.number) {
    console.log(
      `\nThe number is ${phone.status ?? "activating"}. Run this again in a few minutes to print it.`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
