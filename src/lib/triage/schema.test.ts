import { describe, expect, it } from "vitest";
import { EXTRACTION_JSON_SCHEMA, extractedIssueSchema, extractionSchema } from "./schema";

describe("structured-output JSON schema", () => {
  it("requires every field the Zod issue schema expects", () => {
    const zodKeys = Object.keys(extractedIssueSchema.shape).sort();
    const items = EXTRACTION_JSON_SCHEMA.properties.issues.items;
    expect(Object.keys(items.properties).sort()).toEqual(zodKeys);
    expect([...items.required].sort()).toEqual(zodKeys);
  });

  it("requires every top-level field the Zod extraction schema expects", () => {
    const zodKeys = Object.keys(extractionSchema.shape).sort();
    expect(Object.keys(EXTRACTION_JSON_SCHEMA.properties).sort()).toEqual(zodKeys);
    expect([...EXTRACTION_JSON_SCHEMA.required].sort()).toEqual(zodKeys);
  });
});
