import { describe, expect, it } from "vitest";
import { sampleText } from "@/test/fixtures";
import { applySafetyRules, matchRules } from "./rules";

const names = (text: string) => matchRules(text).map((rule) => rule.name);

describe("matchRules on the brief's reports", () => {
  it("flags water reaching an outlet (report 1)", () => {
    expect(names(sampleText("r1"))).toContain("water_electrical");
  });

  it("flags no heat in freezing weather (report 2)", () => {
    expect(names(sampleText("r2"))).toEqual(["no_heat_cold"]);
  });

  it("flags a hedged gas smell (report 4)", () => {
    expect(names(sampleText("r4"))).toEqual(["gas_odor"]);
  });

  it("leaves routine problems alone (reports 3 and 5)", () => {
    expect(names(sampleText("r3"))).toEqual([]);
    expect(names(sampleText("r5"))).toEqual([]);
  });
});

describe("matchRules on near misses", () => {
  it.each([
    "The gas stove works fine, but the oven light is out.",
    "Smoke detector keeps chirping, probably the battery.",
    "The water heater is making a banging noise.",
    "The heater works but the AC is not cooling.",
  ])("does not escalate: %s", (text) => {
    expect(names(text)).toEqual([]);
  });

  it.each([
    ["There's smoke coming out of the outlet.", "fire_smoke"],
    ["A pipe burst under the sink and water is pouring out.", "flooding"],
    ["Our CO detector is going off.", "gas_odor"],
    ["The furnace stopped working and it's really cold in here.", "no_heat_cold"],
  ])("escalates: %s", (text, rule) => {
    expect(names(text)).toContain(rule);
  });
});

describe("matchRules on review round 1 cases", () => {
  it.each([
    "The fire extinguisher is missing from the hallway.",
    "My neighbor keeps smoking in the stairwell.",
    "The water heater isn't working, only cold water comes out.",
  ])("does not escalate: %s", (text) => {
    expect(names(text)).toEqual([]);
  });

  it.each([
    ["The smoke alarm is beeping and there's smoke in the hallway", "fire_smoke"],
    ["There's a fire in the kitchen!", "fire_smoke"],
  ])("escalates: %s", (text, rule) => {
    expect(names(text)).toContain(rule);
  });
});

describe("matchRules on review round 2 cases", () => {
  it("does not escalate: Fire alarm keeps chirping, probably the battery.", () => {
    expect(names("Fire alarm keeps chirping, probably the battery.")).toEqual([]);
  });

  it.each([
    ["The fire alarm is going off", "fire_smoke"],
    ["There's a smoky smell in the hallway.", "fire_smoke"],
  ])("escalates: %s", (text, rule) => {
    expect(names(text)).toContain(rule);
  });
});

describe("matchRules on review round 3 cases", () => {
  it.each([
    "My electric water heater stopped working.",
    "There's a water stain on the wall panel in the hallway",
    "The kitchen faucet drips. The hallway light flickers.",
    "Smoke detector battery is low",
  ])("does not escalate: %s", (text) => {
    expect(names(text)).toEqual([]);
  });

  it.each([
    ["Water is coming through the ceiling light fixture in the bathroom", "water_electrical"],
    [
      "The smoke alarm went off because there's smoke everywhere and it keeps beeping",
      "fire_smoke",
    ],
    ["The fire alarm keeps beeping and I can see flames in the kitchen", "fire_smoke"],
    ["The boiler is out and it's freezing", "no_heat_cold"],
    ["The radiator is broken and it's cold", "no_heat_cold"],
  ])("escalates: %s", (text, rule) => {
    expect(names(text)).toContain(rule);
  });

  it("keeps the brief's results for reports 1 and 3", () => {
    expect(names(sampleText("r1"))).toEqual(["water_electrical"]);
    expect(names(sampleText("r3"))).toEqual([]);
  });
});

describe("matchRules on water near electrical fixtures", () => {
  it.each([
    "Water got into the outlet behind the washing machine.",
    "There's water all over the outlet by the sink.",
    "Water splashed onto the outlet and now it's buzzing.",
    "Water's coming through the light fixture in the bathroom.",
    "Water came through the ceiling light last night.",
    "Water keeps coming out of the light in the hallway.",
  ])("escalates: %s", (text) => {
    expect(names(text)).toContain("water_electrical");
  });

  it("does not count the verb 'switch' as an electrical fixture", () => {
    expect(names("I had to switch the main water valve because the sink is leaking.")).toEqual([]);
  });
});

describe("applySafetyRules", () => {
  it("raises a calm model priority to the rule's floor", () => {
    expect(
      applySafetyRules({ priority: "Medium", rationale: "unsure" }, "maybe I smell gas"),
    ).toEqual({
      priority: "Emergency",
      source: "rule:gas_odor",
      reason: expect.stringContaining("gas odor"),
    });
  });

  it("makes the rule the policy of record when the model already agrees", () => {
    expect(
      applySafetyRules({ priority: "Emergency", rationale: "gas" }, "smells like gas").source,
    ).toBe("rule:gas_odor");
  });

  it("keeps the model's priority when it is above every matched floor", () => {
    expect(
      applySafetyRules(
        { priority: "Emergency", rationale: "elderly tenant, no heat" },
        "the heat isn't working and it's freezing",
      ),
    ).toEqual({ priority: "Emergency", source: "model", reason: "elderly tenant, no heat" });
  });

  it("uses the model's rationale when no rule matches", () => {
    expect(
      applySafetyRules({ priority: "Low", rationale: "cosmetic" }, "window won't close"),
    ).toEqual({
      priority: "Low",
      source: "model",
      reason: "cosmetic",
    });
  });

  it("breaks ties by rule order", () => {
    expect(
      applySafetyRules({ priority: "Low", rationale: "x" }, "I smell gas and see smoke").source,
    ).toBe("rule:gas_odor");
  });

  it("names the rule when the model already sits exactly at a High floor", () => {
    expect(
      applySafetyRules(
        { priority: "High", rationale: "no heat" },
        "the heat isn't working and it's freezing",
      ),
    ).toEqual({
      priority: "High",
      source: "rule:no_heat_cold",
      reason: expect.stringContaining("No heat"),
    });
  });

  it("raises a High model priority to Emergency for a gas odor", () => {
    expect(applySafetyRules({ priority: "High", rationale: "gas" }, "I smell gas")).toEqual({
      priority: "Emergency",
      source: "rule:gas_odor",
      reason: expect.stringContaining("gas odor"),
    });
  });
});
