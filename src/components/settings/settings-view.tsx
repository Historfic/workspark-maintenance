"use client";

import { useDemoSettings } from "@/hooks/use-demo-settings";
import { SettingsForm } from "./settings-form";

export function SettingsView() {
  const { settings, save, reset } = useDemoSettings();
  return (
    <SettingsForm
      key={JSON.stringify(settings)}
      settings={settings}
      onSave={save}
      onReset={reset}
    />
  );
}
