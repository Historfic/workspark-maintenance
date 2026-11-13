import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PropertiesPanel, SafetyRulesPanel } from "@/components/settings/reference-panels";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings · Solvv-Tunic" };

export default function SettingsPage() {
  return (
    <div className="min-h-dvh">
      <PageHeader />
      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
          <p className="mt-1 text-sm text-ink-muted">
            What staff configure. In this demo, changes are kept in your browser only.
          </p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
          <SettingsView />
          <div className="space-y-6">
            <SafetyRulesPanel />
            <PropertiesPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
