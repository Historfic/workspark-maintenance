import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "./settings";

describe("parseSettings", () => {
  it("returns the defaults for missing or broken input", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"backupWaitMinutes":"soon"}')).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid saved settings", () => {
    const saved = { ...DEFAULT_SETTINGS, backupWaitMinutes: 3 };
    expect(parseSettings(JSON.stringify(saved))).toEqual(saved);
  });

  it("rejects a backup wait outside 1 to 30 minutes", () => {
    const saved = { ...DEFAULT_SETTINGS, backupWaitMinutes: 0 };
    expect(parseSettings(JSON.stringify(saved))).toEqual(DEFAULT_SETTINGS);
  });
});
