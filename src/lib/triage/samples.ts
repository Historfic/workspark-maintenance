import type { IssueType, Priority } from "./schema";
import type { PrioritySource } from "./types";

export interface ExpectedTicket {
  issue_type: IssueType;
  priorities: readonly Priority[];
  unit: string | null;
  needs_followup: boolean;
  priority_source?: PrioritySource;
}

export interface SampleReport {
  id: string;
  label: string;
  text: string;
  expected: readonly ExpectedTicket[];
}

export const SAMPLE_REPORTS: readonly SampleReport[] = [
  {
    id: "r1",
    label: "4B ceiling leak",
    text: "Hi, this is apartment 4B. There is a major water leak coming from the ceiling in the bathroom and it's dripping onto the outlet!",
    expected: [
      {
        issue_type: "Plumbing",
        priorities: ["Emergency"],
        unit: "4B",
        needs_followup: false,
        priority_source: "rule:water_electrical",
      },
    ],
  },
  {
    id: "r2",
    label: "No heat, no unit",
    text: "Hey, the heat isn't working in my place and it's freezing. Can someone come today?",
    expected: [
      {
        issue_type: "HVAC",
        priorities: ["High"],
        unit: null,
        needs_followup: true,
        priority_source: "rule:no_heat_cold",
      },
    ],
  },
  {
    id: "r3",
    label: "12C sink + light",
    text: "Unit 12C here. The kitchen sink is clogged, and also the hallway light outside my door has been flickering for a week.",
    expected: [
      { issue_type: "Plumbing", priorities: ["Medium"], unit: "12C", needs_followup: false },
      {
        issue_type: "Electrical",
        priorities: ["Low", "Medium"],
        unit: "12C",
        needs_followup: false,
      },
    ],
  },
  {
    id: "r4",
    label: "7A maybe gas",
    text: "Yeah hi, so um, I'm in 7A, and I don't know if it's a big deal, but there's kind of a weird smell near the stove, like maybe gas? My neighbor said it's probably nothing but I wanted to call anyway.",
    expected: [
      {
        issue_type: "Gas",
        priorities: ["Emergency"],
        unit: "7A",
        needs_followup: false,
        priority_source: "rule:gas_odor",
      },
    ],
  },
  {
    id: "r5",
    label: "2D window",
    text: "This is 2D. My bedroom window won't close all the way. Not urgent, whenever you get a chance.",
    expected: [
      { issue_type: "Structural", priorities: ["Low"], unit: "2D", needs_followup: false },
    ],
  },
];
