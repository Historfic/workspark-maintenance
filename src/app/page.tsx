import { createClient } from "@supabase/supabase-js";
import { Dashboard } from "@/components/dashboard";
import { requireEnv } from "@/lib/env";
import { listWorkOrders } from "@/lib/db/public-reads";

export const dynamic = "force-dynamic";

export default async function Home() {
  const client = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const orders = await listWorkOrders(client);
  return <Dashboard initialOrders={orders} initialNow={new Date().toISOString()} />;
}
