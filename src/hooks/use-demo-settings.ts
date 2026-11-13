"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, parseSettings, type DemoSettings } from "@/lib/demo/settings";

const STORAGE_KEY = "solvv-tunic-demo-settings";
const CHANGE_EVENT = "solvv-tunic-demo-settings-change";

// Kept in memory too, so the page still reflects a save when the browser blocks localStorage.
let memoryRaw: string | null = null;
let cachedRaw: string | null | undefined;
let cachedSettings: DemoSettings = DEFAULT_SETTINGS;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryRaw;
  } catch {
    return memoryRaw;
  }
}

function getSnapshot(): DemoSettings {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSettings = parseSettings(raw);
  }
  return cachedSettings;
}

function getServerSnapshot(): DemoSettings {
  return DEFAULT_SETTINGS;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function write(raw: string | null): void {
  memoryRaw = raw;
  try {
    if (raw === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Private windows can refuse storage; the in-memory copy still updates this tab.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useDemoSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const save = useCallback((next: DemoSettings) => write(JSON.stringify(next)), []);
  const reset = useCallback(() => write(null), []);
  return { settings, save, reset };
}
