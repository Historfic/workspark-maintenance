import { z } from "zod";

export const ENTRY_POLICIES = {
  permission_required: "Enter only with the tenant's permission",
  tenant_present: "Enter only when the tenant is home",
  emergency_any_time: "Enter any time for emergencies; otherwise ask first",
} as const;

export type EntryPolicy = keyof typeof ENTRY_POLICIES;

const contactSchema = z.object({ name: z.string().min(1).max(60), phone: z.string().max(30) });

const settingsSchema = z.object({
  primary: contactSchema,
  backup: contactSchema,
  backupWaitMinutes: z.number().int().min(1).max(30),
  officeHours: z.object({ open: z.string(), close: z.string() }),
  entryPolicy: z.enum(Object.keys(ENTRY_POLICIES) as [EntryPolicy, ...EntryPolicy[]]),
});

export type DemoSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: DemoSettings = {
  primary: { name: "Mike Reyes (super)", phone: "(555) 012-0001" },
  backup: { name: "Tom Nguyen (backup)", phone: "(555) 012-0002" },
  backupWaitMinutes: 5,
  officeHours: { open: "08:00", close: "18:00" },
  entryPolicy: "emergency_any_time",
};

export function parseSettings(raw: string | null): DemoSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
