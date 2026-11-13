import { describe, expect, it } from "vitest";
import { escalationStatus, escalationTimeline } from "./escalation";
import { DEFAULT_SETTINGS } from "./settings";

const CREATED = "2026-11-14T02:00:00.000Z";
const at = (seconds: number) => new Date(Date.parse(CREATED) + seconds * 1000);
const settings = { ...DEFAULT_SETTINGS, backupWaitMinutes: 5 };

describe("escalationTimeline", () => {
  it("runs ticket, super, backup, answered in that order", () => {
    const steps = escalationTimeline(CREATED, settings, "SI-1042", at(0));
    expect(steps.map((step) => step.key)).toEqual(["ticket", "super", "backup", "answered"]);
    expect(steps[0]?.label).toContain("SI-1042");
    expect(steps[1]?.label).toContain(settings.primary.name);
    expect(steps[2]?.label).toContain(settings.backup.name);
  });

  it("schedules the backup N minutes after the super is called", () => {
    const steps = escalationTimeline(CREATED, settings, "SI-1", at(0));
    const gap = (steps[2]?.at.getTime() ?? 0) - (steps[1]?.at.getTime() ?? 0);
    expect(gap).toBe(5 * 60_000);
  });

  it("marks the latest reached step active and later steps scheduled", () => {
    const steps = escalationTimeline(CREATED, settings, "SI-1", at(30));
    expect(steps.map((step) => step.state)).toEqual(["done", "active", "scheduled", "scheduled"]);
  });

  it("marks every step done once the backup has answered", () => {
    const steps = escalationTimeline(CREATED, settings, "SI-1", at(20 + 300 + 60));
    expect(steps.every((step) => step.state === "done")).toBe(true);
  });
});

describe("escalationStatus", () => {
  it("follows the timeline", () => {
    expect(escalationStatus(CREATED, settings, at(5))).toBe("calling_super");
    expect(escalationStatus(CREATED, settings, at(20 + 300 + 1))).toBe("calling_backup");
    expect(escalationStatus(CREATED, settings, at(20 + 300 + 60))).toBe("answered");
  });
});
