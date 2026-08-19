import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import { parseCsvString } from "@/lib/csv-server";
import { autoMapColumns, validateMappings } from "@/lib/csv-core";
import { TIME_ENTRY_FIELD_DEFS } from "@/lib/time-import";
import { buildImportRows } from "@/lib/imports/types";
import { CLIENT_IMPORT_SPEC } from "@/lib/imports/clients";

describe("parseCsvString (server parser)", () => {
  it("parses headers and data rows with correct row numbers", () => {
    const parsed = parseCsvString(
      "Client,Team Member,Task,Hours,Work Date\nAcme Corp,Jane Doe,Website design,8,2026-01-15\n",
    );
    assert.ok(parsed);
    assert.deepEqual(parsed.columns, [
      "Client",
      "Team Member",
      "Task",
      "Hours",
      "Work Date",
    ]);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].rowNumber, 2);
    assert.deepEqual(parsed.rows[0].cells, {
      Client: "Acme Corp",
      "Team Member": "Jane Doe",
      Task: "Website design",
      Hours: "8",
      "Work Date": "2026-01-15",
    });
  });

  it("handles a BOM and CRLF line endings", () => {
    const parsed = parseCsvString(
      "\uFEFFClient,Team Member,Task,Hours,Work Date\r\nAcme Corp,Jane Doe,Design,4,2026-01-15\r\n",
    );
    assert.ok(parsed);
    assert.deepEqual(parsed.columns, [
      "Client",
      "Team Member",
      "Task",
      "Hours",
      "Work Date",
    ]);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].cells.Client, "Acme Corp");
  });

  it("handles quoted fields with commas", () => {
    const parsed = parseCsvString(
      'Client,Team Member,Task,Hours,Work Date\nAcme Corp,Jane Doe,"Research, writing",8,2026-01-15\n',
    );
    assert.ok(parsed);
    assert.equal(parsed.rows[0].cells.Task, "Research, writing");
  });

  it("does not shift columns when data is missing in a row", () => {
    const parsed = parseCsvString(
      "Client,Team Member,Task,Hours,Work Date\nAcme Corp,Jane Doe,Design,,\n",
    );
    assert.ok(parsed);
    assert.equal(parsed.rows[0].cells.Client, "Acme Corp");
    assert.equal(parsed.rows[0].cells["Team Member"], "Jane Doe");
    assert.equal(parsed.rows[0].cells.Task, "Design");
    assert.equal(parsed.rows[0].cells.Hours, "");
  });

  it("returns an empty parse for empty input", () => {
    assert.deepEqual(parseCsvString(""), { columns: [], rows: [] });
  });

  it("agrees with the client-side parser (papaparse) on headers", () => {
    const raw =
      "Client,Team Member,Task,Hours,Work Date\n" +
      "Acme Corp,Jane Doe,Keyword Research,8,2026-01-15\n";
    const server = parseCsvString(raw);
    assert.ok(server);
    const client = Papa.parse<Record<string, string>>(raw, {
      header: true,
      skipEmptyLines: "greedy",
    });
    assert.deepEqual(client.meta.fields, server.columns);
    assert.equal(client.data.length, server.rows.length);
    for (let index = 0; index < client.data.length; index += 1) {
      assert.deepEqual(client.data[index], server.rows[index]?.cells);
    }
  });
});

describe("end-to-end parse → map → validate → build", () => {
  it("correctly imports a standard time entry CSV", () => {
    const raw =
      "Client,Team Member,Task,Hours,Work Date\n" +
      "Acme Corp,Jane Doe,Keyword Research,8,2026-01-15\n";
    const parsed = parseCsvString(raw);
    assert.ok(parsed);
    const mapping = autoMapColumns(parsed.columns, TIME_ENTRY_FIELD_DEFS);
    assert.deepEqual(mapping, {
      client: "Client",
      member: "Team Member",
      task: "Task",
      hours: "Hours",
      date: "Work Date",
    });
    const issues = validateMappings(mapping, TIME_ENTRY_FIELD_DEFS, parsed.columns);
    assert.deepEqual(issues, []);
  });

  it("correctly imports a client CSV end to end", () => {
    const raw =
      "Company Name,Website,Primary Contact,Contact Email,Phone,Status,Notes\n" +
      "Acme Corp,https://acme.example.com,Jane Doe,jane@acme.example.com,+1 555 0100,ACTIVE,Design retainer\n";
    const parsed = parseCsvString(raw);
    assert.ok(parsed);
    const mapping = autoMapColumns(parsed.columns, CLIENT_IMPORT_SPEC.fields);
    const issues = validateMappings(mapping, CLIENT_IMPORT_SPEC.fields, parsed.columns);
    assert.deepEqual(issues, []);
    const rows = buildImportRows(parsed, mapping, CLIENT_IMPORT_SPEC, {
      existingClientNames: [],
    });
    assert.ok(rows[0].errors.length === 0);
    assert.equal(rows[0].resolved?.name, "Acme Corp");
  });

  it("keeps preview values aligned with their mapped columns", () => {
    const raw =
      "Hours,Task,Team Member,Client,Work Date\n" +
      "8,Keyword Research,Jane Doe,Acme Corp,2026-01-15\n";
    const parsed = parseCsvString(raw);
    assert.ok(parsed);
    const mapping = autoMapColumns(parsed.columns, TIME_ENTRY_FIELD_DEFS);
    assert.deepEqual(mapping, {
      client: "Client",
      member: "Team Member",
      task: "Task",
      hours: "Hours",
      date: "Work Date",
    });
    assert.equal(parsed.rows[0].cells.Client, "Acme Corp");
    assert.equal(parsed.rows[0].cells["Team Member"], "Jane Doe");
    assert.equal(parsed.rows[0].cells.Task, "Keyword Research");
    assert.equal(parsed.rows[0].cells.Hours, "8");
  });
});
