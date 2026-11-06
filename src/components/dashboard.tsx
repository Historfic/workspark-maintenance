"use client";

import { useEffect, useMemo, useState } from "react";
import { IntakePanel } from "@/components/intake/intake-panel";
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

  return (
    <div className="min-h-dvh">
      <PageHeader right={<LiveIndicator connection={state.connection} />} />
      <main className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6 lg:grid-cols-[22rem_1fr]">
        <IntakePanel onCreated={onCreated} />
        <section aria-labelledby="orders-heading" className="min-w-0">
          <h2 id="orders-heading" className="sr-only">
            Work orders
          </h2>
          <FilterTabs value={filter} counts={counts} onChange={setFilter}>
            <div className="mt-4">
              <WorkOrderList
                orders={state.orders}
                recentIds={state.recentIds}
                filter={filter}
                now={now}
                onStatusChange={onStatusChange}
                onOpen={setOpenId}
              />
            </div>
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
