import { describe, expect, it } from "vitest";
import { agentReply, conversationLines } from "./conversation";

const ticket = (overrides: Partial<Parameters<typeof agentReply>[0][number]> = {}) => ({
  id: "t1",
  priority: "Medium" as const,
  issue_type: "Plumbing" as const,
  unit: "12C",
  ...overrides,
});

describe("conversationLines", () => {
  it("splits a call transcript into tenant and agent turns", () => {
    const lines = conversationLines(
      {
        source: "web_call",
        raw_text: "Agent: Hi, what's going on?\nCaller: My sink is clogged.\nin the kitchen",
      },
      null,
    );
    expect(lines).toEqual([
      { speaker: "agent", text: "Hi, what's going on?", simulated: false },
      { speaker: "tenant", text: "My sink is clogged.\nin the kitchen", simulated: false },
    ]);
  });

  it("shows a typed report as one tenant message plus the simulated reply", () => {
    const lines = conversationLines({ source: "text", raw_text: "Heat is out" }, "Thanks.");
    expect(lines).toEqual([
      { speaker: "tenant", text: "Heat is out", simulated: false },
      { speaker: "agent", text: "Thanks.", simulated: true },
    ]);
  });
});

describe("agentReply", () => {
  it("greets the tenant by first name and lists each ticket number", () => {
    const reply = agentReply(
      [ticket({ id: "a" }), ticket({ id: "b", issue_type: "Electrical" })],
      "James Carter",
      (id) => `SI-${id}`,
    );
    expect(reply).toMatch(/^Thanks, James\./);
    expect(reply).toContain("SI-a (Plumbing)");
    expect(reply).toContain("SI-b (Electrical)");
    expect(reply).toMatch(/available/);
  });

  it("says the super is being called for an emergency", () => {
    const reply = agentReply([ticket({ priority: "Emergency" })], null, () => "SI-1");
    expect(reply).toMatch(/calling the on-call super/);
  });

  it("asks for the unit when it is missing", () => {
    const reply = agentReply([ticket({ unit: null, priority: "High" })], null, () => "SI-1");
    expect(reply).toMatch(/which unit/i);
  });
});
