import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  autoMapColumns,
  validateMappings,
  type ParsedCsv,
} from "@/lib/csv-core";
import {
  buildImportRows,
  firstRowError,
  isImportableRow,
  type ImportRefs,
  type ImportRow,
} from "@/lib/imports/types";
import { CLIENT_IMPORT_SPEC } from "@/lib/imports/clients";
import { RETAINER_IMPORT_SPEC } from "@/lib/imports/retainers";
import { TEAM_IMPORT_SPEC } from "@/lib/imports/team";

function parsedCsv(
  columns: string[],
  dataRows: string[][],
): ParsedCsv {
  return {
    columns,
    rows: dataRows.map((values, index) => {
      const cells: Record<string, string> = {};
      columns.forEach((column, columnIndex) => {
        cells[column] = values[columnIndex] ?? "";
      });
      return { rowNumber: index + 2, cells };
    }),
  };
}

function mapAndBuild(
  spec: (typeof CLIENT_IMPORT_SPEC) | (typeof RETAINER_IMPORT_SPEC) | (typeof TEAM_IMPORT_SPEC),
  csv: ParsedCsv,
  refs: ImportRefs,
): { mapping: Record<string, string | null>; rows: ImportRow[] } {
  const mapping = autoMapColumns(csv.columns, spec.fields);
  const issues = validateMappings(mapping, spec.fields, csv.columns);
  assert.deepEqual(issues, [], `unexpected mapping issues: ${JSON.stringify(issues)}`);
  return { mapping, rows: buildImportRows(csv, mapping, spec, refs) };
}

describe("client import spec", () => {
  const columns = [
    "Company Name",
    "Website",
    "Primary Contact",
    "Contact Email",
    "Phone",
    "Status",
    "Notes",
  ];

  it("imports a valid row", () => {
    const csv = parsedCsv(columns, [
      [
        "Acme Corp",
        "https://acme.example.com",
        "Jane Doe",
        "jane@acme.example.com",
        "+1 555 0100",
        "ACTIVE",
        "Design retainer",
      ],
    ]);
    const { rows } = mapAndBuild(CLIENT_IMPORT_SPEC, csv, {
      existingClientNames: [],
    });
    assert.ok(isImportableRow(rows[0]), firstRowError(rows[0]) ?? "");
    assert.equal(rows[0].resolved?.name, "Acme Corp");
    assert.equal(rows[0].resolved?.website, "https://acme.example.com");
    assert.equal(rows[0].resolved?.contactEmail, "jane@acme.example.com");
    assert.equal(rows[0].resolved?.status, "ACTIVE");
  });

  it("flags an existing client name", () => {
    const csv = parsedCsv(columns, [["Acme Corp", "", "", "", "", "", ""]]);
    const { rows } = mapAndBuild(CLIENT_IMPORT_SPEC, csv, {
      existingClientNames: ["Acme Corp"],
    });
    assert.equal(isImportableRow(rows[0]), false);
    assert.match(firstRowError(rows[0]) ?? "", /Acme Corp/);
  });

  it("flags an existing client name regardless of casing and whitespace", () => {
    const csv = parsedCsv(columns, [["  acme  corp  ", "", "", "", "", "", ""]]);
    const { rows } = mapAndBuild(CLIENT_IMPORT_SPEC, csv, {
      existingClientNames: ["Acme Corp"],
    });
    assert.equal(isImportableRow(rows[0]), false);
    assert.match(firstRowError(rows[0]) ?? "", /already exists/);
  });

  it("reports a missing Company Name column as a mapping issue", () => {
    const csv = parsedCsv(
      ["Website", "Primary Contact", "Contact Email"],
      [["https://acme.example.com", "Jane Doe", "jane@acme.example.com"]],
    );
    const mapping = autoMapColumns(csv.columns, CLIENT_IMPORT_SPEC.fields);
    const issues = validateMappings(mapping, CLIENT_IMPORT_SPEC.fields, csv.columns);
    assert.ok(
      issues.some((issue) => issue.message === "Company Name column is not mapped."),
    );
  });
});

describe("retainer import spec", () => {
  const columns = [
    "Client",
    "Monthly Budget",
    "Currency",
    "Billing Cycle",
    "Scope Hours",
    "Start Date",
    "End Date",
  ];

  it("imports a valid row", () => {
    const csv = parsedCsv(columns, [
      [
        "Acme Corp",
        "10000",
        "USD",
        "MONTHLY",
        "120",
        "2026-01-01",
        "2026-12-31",
      ],
    ]);
    const { rows } = mapAndBuild(RETAINER_IMPORT_SPEC, csv, {
      clients: [{ id: "client-1", name: "Acme Corp" }],
      existingActiveClients: [],
    });
    assert.ok(isImportableRow(rows[0]), firstRowError(rows[0]) ?? "");
    assert.equal(rows[0].resolved?.clientId, "client-1");
    assert.equal(rows[0].resolved?.monthlyBudget, 10000);
    assert.equal(rows[0].resolved?.startDate, "2026-01-01");
    assert.equal(rows[0].resolved?.endDate, "2026-12-31");
  });

  it("reports an unknown client", () => {
    const csv = parsedCsv(columns, [
      ["Nonexistent Ltd", "10000", "USD", "MONTHLY", "120", "2026-01-01", ""],
    ]);
    const { rows } = mapAndBuild(RETAINER_IMPORT_SPEC, csv, {
      clients: [{ id: "client-1", name: "Acme Corp" }],
      existingActiveClients: [],
    });
    assert.equal(isImportableRow(rows[0]), false);
    assert.match(firstRowError(rows[0]) ?? "", /No client found for "Nonexistent Ltd"/);
  });

  it("matches clients regardless of casing and surrounding whitespace", () => {
    const csv = parsedCsv(
      ["Client", "Retainer Amount", "Start Date"],
      [
        ["  Acme Corp  ", "10000", "2026-01-01"],
        ["ACME corp", "5000", "2026-02-01"],
      ],
    );
    const { rows } = mapAndBuild(RETAINER_IMPORT_SPEC, csv, {
      clients: [{ id: "client-1", name: "Acme Corp" }],
      existingActiveClients: [],
    });
    assert.ok(isImportableRow(rows[0]), firstRowError(rows[0]) ?? "");
    assert.equal(rows[0].resolved?.clientId, "client-1");
    assert.ok(isImportableRow(rows[1]), firstRowError(rows[1]) ?? "");
    assert.equal(rows[1].resolved?.clientId, "client-1");
  });

  it("matches a client whose stored name has hidden whitespace", () => {
    const csv = parsedCsv(
      ["Client", "Retainer Amount", "Start Date"],
      [["Acme Corp", "10000", "2026-01-01"]],
    );
    const { rows } = mapAndBuild(RETAINER_IMPORT_SPEC, csv, {
      clients: [{ id: "client-1", name: "  Acme   Corp " }],
      existingActiveClients: [],
    });
    assert.ok(isImportableRow(rows[0]), firstRowError(rows[0]) ?? "");
    assert.equal(rows[0].resolved?.clientId, "client-1");
  });

  it("reports the exact unmatched client name", () => {
    const csv = parsedCsv(
      ["Client", "Retainer Amount", "Start Date"],
      [["Northstar SEO", "10000", "2026-01-01"]],
    );
    const { rows } = mapAndBuild(RETAINER_IMPORT_SPEC, csv, {
      clients: [{ id: "client-1", name: "Acme Corp" }],
      existingActiveClients: [],
    });
    assert.equal(isImportableRow(rows[0]), false);
    assert.match(firstRowError(rows[0]) ?? "", /"Northstar SEO"/);
  });

  it("maps headers with underscores", () => {
    const csv = parsedCsv(
      ["Client", "Monthly_Budget", "Currency", "Billing_Cycle", "Scope_Hours", "Start_Date", "End_Date"],
      [["Acme Corp", "5000", "USD", "MONTHLY", "60", "2026-03-01", ""]],
    );
    const { rows } = mapAndBuild(RETAINER_IMPORT_SPEC, csv, {
      clients: [{ id: "client-1", name: "Acme Corp" }],
      existingActiveClients: [],
    });
    assert.ok(isImportableRow(rows[0]), firstRowError(rows[0]) ?? "");
    assert.equal(rows[0].resolved?.monthlyBudget, 5000);
  });
});

describe("team import spec", () => {
  it("imports a valid row", () => {
    const csv = parsedCsv(["Email", "Role"], [["alex@acme.example.com", "MEMBER"]]);
    const { rows } = mapAndBuild(TEAM_IMPORT_SPEC, csv, { existingEmails: [] });
    assert.ok(isImportableRow(rows[0]), firstRowError(rows[0]) ?? "");
    assert.equal(rows[0].resolved?.email, "alex@acme.example.com");
    assert.equal(rows[0].resolved?.role, "MEMBER");
  });

  it("flags an existing email", () => {
    const csv = parsedCsv(["Email"], [["alex@acme.example.com"]]);
    const mapping = autoMapColumns(csv.columns, TEAM_IMPORT_SPEC.fields);
    const issues = validateMappings(mapping, TEAM_IMPORT_SPEC.fields, csv.columns);
    assert.deepEqual(issues, []);
    const rows = buildImportRows(csv, mapping, TEAM_IMPORT_SPEC, {
      existingEmails: ["alex@acme.example.com"],
    });
    assert.equal(isImportableRow(rows[0]), false);
    assert.match(firstRowError(rows[0]) ?? "", /already a member/);
  });

  it("reports a missing Email column as a mapping issue", () => {
    const mapping = autoMapColumns(["Role"], TEAM_IMPORT_SPEC.fields);
    const issues = validateMappings(mapping, TEAM_IMPORT_SPEC.fields, ["Role"]);
    assert.deepEqual(issues, [
      { field: "email", message: "Email column is not mapped." },
    ]);
  });
});
