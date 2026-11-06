"use client";

import { useEffect, useMemo, useState } from "react";
import { IntakePanel } from "@/components/intake/intake-panel";
import { TriageExplainer } from "@/components/intake/triage-explainer";
import { FilterTabs } from "@/components/orders/filter-tabs";
import { OrderDrawer } from "@/components/orders/order-drawer";
import { WorkOrderList } from "@/components/orders/work-order-list";
import { LiveIndicator } from "@/components/live-indicator";
import { PageHeader } from "@/components/page-header";
import { useWorkOrdersFeed } from "@/hooks/use-work-orders-feed";
import type { WorkOrderRow } from "@/lib/db/types";
import { countFilters, type FilterKey } from "@/lib/dashboard/filters";
import type { Status } from "@/lib/triage/schema";

async function patchStatus(id: string, status: Status): Promise<void> {
  const response = await fetch(`/api/work-orders/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(`Could not save the status (${response.status}).`);
}

export function Dashboard({
  initialOrders,
  initialNow,
}: {
  initialOrders: WorkOrderRow[];
  initialNow: string;
}) {
  const { state, dispatch } = useWorkOrdersFeed(initialOrders);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  // The server's clock seeds `now` so the first client render matches the HTML it hydrates.
  const [now, setNow] = useState(() => new Date(initialNow));
  const [liveText, setLiveText] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Clearing and re-setting the live region guarantees a DOM change per announcement, so two
  // tickets with identical text are both read out.
  useEffect(() => {
    if (!state.announcement) return;
    const { text } = state.announcement;
    const clear = setTimeout(() => setLiveText(""), 0);
    const announce = setTimeout(() => setLiveText(text), 50);
    return () => {
      clearTimeout(clear);
      clearTimeout(announce);
    };
  }, [state.announcement]);

  const counts = useMemo(() => countFilters(state.orders), [state.orders]);
  const openOrder = state.orders.find((order) => order.id === openId) ?? null;

  async function onStatusChange(id: string, status: Status) {
    const previous = state.orders.find((order) => order.id === id)?.status;
    dispatch({ type: "setStatus", id, status });
    try {
      await patchStatus(id, status);
    } catch (error) {
      if (previous) dispatch({ type: "setStatus", id, status: previous });
      throw error;
    }
  }

  function onCreated(orders: WorkOrderRow[]) {
    for (const row of orders) dispatch({ type: "upsert", row, fromRealtime: false });
  }

  // Phones get the list right under the form; the explainer drops to the end. From `md` the two
  // panels sit side by side above the list, and from `xl` they stack in a left column beside it.
  return (
    <div className="min-h-dvh">
      <PageHeader right={<LiveIndicator connection={state.connection} tone="dark" />} />
      <main className="mx-auto grid max-w-[96rem] items-start gap-6 p-4 md:grid-cols-2 md:p-6 xl:grid-cols-[20rem_1fr] xl:grid-rows-[auto_1fr]">
        <IntakePanel onCreated={onCreated} />
        <TriageExplainer className="order-last md:order-none xl:col-start-1" />
        <section
          aria-labelledby="orders-heading"
          className="min-w-0 rounded border border-line bg-surface shadow-card md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-span-2 xl:row-start-1"
        >
          <h2 id="orders-heading" className="sr-only">
            Work orders
          </h2>
          <FilterTabs value={filter} counts={counts} onChange={setFilter}>
            <WorkOrderList
              orders={state.orders}
              recentIds={state.recentIds}
              filter={filter}
              now={now}
              onStatusChange={onStatusChange}
              onOpen={setOpenId}
            />
          </FilterTabs>
        </section>
      </main>
      <p className="sr-only" aria-live="polite">
        {liveText}
      </p>
      <OrderDrawer order={openOrder} onClose={() => setOpenId(null)} />
    </div>
  );
}
