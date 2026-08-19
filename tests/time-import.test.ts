import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  suggestMapping,
  validateImportRows,
  detectTeamMemberValues,
  suggestTeamMemberMapping,
  parseCsvDate,
  parseCsvHours,
  firstRowError,
  isImportableRow,
  type FieldMapping,
  type ParsedCsv,
} from "@/lib/time-import";
import { validateMappings } from "@/lib/csv-core";
import { TIME_ENTRY_FIELD_DEFS } from "@/lib/time-import";

const REFS = {
  clients: [{ id: "client-1", name: "Acme Corp" }],
  members: [
    {
      id: "member-1",
      name: "Jane Doe",
      email: "jane@acme.example.com",
    },
  ],
};

function parsedCsv(rows: Record<string, string>[]): ParsedCsv {
  const columns = ["Client", "Team Member", "Task", "Hours", "Work Date"];
  return {
    columns,
    rows: rows.map((cells, index) => ({
      rowNumber: index + 2,
      cells: { ...cells },
    })),
  };
}

const CORRECT_MAPPING: FieldMapping = {
  client: "Client",
  member: "Team Member",
  task: "Task",
  hours: "Hours",
  date: "Work Date",
};

const MEMBER_MAPPING = { "Jane Doe": "member-1" };

describe("time entry import", () => {
  it("auto-maps the reported CSV to the correct columns", () => {
    const mapping = suggestMapping([
      "Client",
      "Team Member",
      "Task",
      "Hours",
      "Work Date",
    ]);
    assert.deepEqual(mapping, CORRECT_MAPPING);
  });

  it("does not report mapping issues for correct headers", () => {
    const issues = validateMappings(
      suggestMapping(["Client", "Team Member", "Task", "Hours", "Work Date"]),
      TIME_ENTRY_FIELD_DEFS,
      ["Client", "Team Member", "Task", "Hours", "Work Date"],
    );
    assert.deepEqual(issues, []);
  });

  it("validates rows against the mapped columns, not column positions", () => {
    const rows = validateImportRows(
      parsedCsv([
        {
          Client: "Acme Corp",
          "Team Member": "Jane Doe",
          Task: "Keyword Research",
          Hours: "8",
          "Work Date": "2026-01-15",
        },
      ]),
      CORRECT_MAPPING,
      REFS,
      MEMBER_MAPPING,
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].errors.length, 0, rows[0].errors.map((e) => e.message).join(", "));
    assert.ok(isImportableRow(rows[0]));
    assert.equal(rows[0].values.task, "Keyword Research");
    assert.equal(rows[0].values.member, "Jane Doe");
    assert.equal(rows[0].resolved?.clientId, "client-1");
    assert.equal(rows[0].resolved?.memberId, "member-1");
    assert.equal(rows[0].resolved?.hours, 8);
  });

  it("resolves team members only through the member mapping", () => {
    const rows = validateImportRows(
      parsedCsv([
        {
          Client: "Acme Corp",
          "Team Member": "JANE DOE",
          Task: "Design",
          Hours: "2.5",
          "Work Date": "2026-01-15",
        },
      ]),
      CORRECT_MAPPING,
      REFS,
      { "JANE DOE": "member-1" },
    );
    assert.ok(isImportableRow(rows[0]));
    assert.equal(rows[0].resolved?.memberId, "member-1");
  });

  it("reports a member that has no mapping entry", () => {
    const rows = validateImportRows(
      parsedCsv([
        {
          Client: "Acme Corp",
          "Team Member": "Nobody Here",
          Task: "Design",
          Hours: "2",
          "Work Date": "2026-01-15",
        },
      ]),
      CORRECT_MAPPING,
      REFS,
      MEMBER_MAPPING,
    );
    assert.equal(isImportableRow(rows[0]), false);
    assert.match(
      firstRowError(rows[0]) ?? "",
      /Team member "Nobody Here" is not mapped to a workspace member/,
    );
  });

  it("maps reordered columns correctly before validating rows", () => {
    const mapping = suggestMapping([
      "Work Date",
      "Hours",
      "Task",
      "Team Member",
      "Client",
    ]);
    assert.deepEqual(mapping, CORRECT_MAPPING);

    const rows = validateImportRows(
      {
        columns: ["Work Date", "Hours", "Task", "Team Member", "Client"],
        rows: [
          {
            rowNumber: 2,
            cells: {
              "Work Date": "2026-01-15",
              Hours: "8",
              Task: "Keyword Research",
              "Team Member": "Jane Doe",
              Client: "Acme Corp",
            },
          },
        ],
      },
      mapping,
      REFS,
      MEMBER_MAPPING,
    );
    assert.ok(isImportableRow(rows[0]));
    assert.equal(rows[0].values.task, "Keyword Research");
    assert.equal(rows[0].values.member, "Jane Doe");
  });

  it("keeps preview values exactly as they appear in the CSV", () => {
    const rows = validateImportRows(
      parsedCsv([
        {
          Client: "  Acme Corp  ",
          "Team Member": " Jane Doe ",
          Task: "Task with, comma",
          Hours: " 8 ",
          "Work Date": "2026-01-15",
        },
      ]),
      CORRECT_MAPPING,
      REFS,
      { "Jane Doe": "member-1" },
    );
    assert.equal(rows[0].values.task, "Task with, comma");
    assert.equal(rows[0].values.hours, "8");
    assert.equal(rows[0].values.client, "Acme Corp");
  });
});

describe("100-row import payload", () => {
  it("resolves every row and builds one payload item per row outside a transaction", () => {
    const csvRows: Record<string, string>[] = [];
    for (let index = 0; index < 100; index += 1) {
      csvRows.push({
        Client: "Acme Corp",
        "Team Member": "Jane Doe",
        Task: `Task ${String(index + 1).padStart(3, "0")}`,
        Hours: String((index % 8) + 1 + ((index % 3) / 4)),
        "Work Date": `2026-0${(index % 6) + 1}-15`,
      });
    }

    const rows = validateImportRows(
      parsedCsv(csvRows),
      CORRECT_MAPPING,
      REFS,
      MEMBER_MAPPING,
    );

    assert.equal(rows.length, 100);
    const importable = rows.filter(isImportableRow);
    assert.equal(importable.length, 100);

    const payload = importable.map((row) => ({
      workspaceId: "workspace-1",
      clientId: row.resolved!.clientId,
      memberId: row.resolved!.memberId,
      task: row.values.task,
      hours: row.resolved!.hours,
      workDate: row.resolved!.workDate,
      source: "CSV" as const,
    }));

    assert.equal(payload.length, 100);
    for (const item of payload) {
      assert.equal(item.workspaceId, "workspace-1");
      assert.equal(item.clientId, "client-1");
      assert.equal(item.memberId, "member-1");
      assert.equal(item.source, "CSV");
      assert.equal(typeof item.hours, "number");
      assert.ok(item.hours > 0);
      assert.ok(item.workDate instanceof Date);
      assert.match(item.task, /^Task \d{3}$/);
    }
  });
});

describe("detectTeamMemberValues", () => {
  it("collects unique team member values in order of appearance", () => {
    const csv = parsedCsv([
      {
        Client: "Acme Corp",
        "Team Member": "Jane Doe",
        Task: "A",
        Hours: "2",
        "Work Date": "2026-01-15",
      },
      {
        Client: "Acme Corp",
        "Team Member": "John Smith",
        Task: "B",
        Hours: "3",
        "Work Date": "2026-01-16",
      },
      {
        Client: "Acme Corp",
        "Team Member": "Jane Doe",
        Task: "C",
        Hours: "1",
        "Work Date": "2026-01-17",
      },
      {
        Client: "Acme Corp",
        "Team Member": "",
        Task: "D",
        Hours: "1",
        "Work Date": "2026-01-18",
      },
    ]);
    assert.deepEqual(
      detectTeamMemberValues(csv, CORRECT_MAPPING),
      ["Jane Doe", "John Smith"],
    );
  });
});

describe("suggestTeamMemberMapping", () => {
  it("auto-maps names that exactly match an existing member", () => {
    const mapping = suggestTeamMemberMapping(
      ["Jane Doe", "John Smith", "Alex"],
      [
        { id: "member-1", name: "Jane Doe", email: "jane@acme.example.com" },
        { id: "member-2", name: "John Smith", email: "john@acme.example.com" },
      ],
    );
    assert.deepEqual(mapping, {
      "Jane Doe": "member-1",
      "John Smith": "member-2",
    });
  });

  it("auto-maps names case-insensitively and by email", () => {
    const mapping = suggestTeamMemberMapping(
      ["jane doe", "JOHN@ACME.EXAMPLE.COM"],
      [
        { id: "member-1", name: "Jane Doe", email: "jane@acme.example.com" },
        { id: "member-2", name: "John Smith", email: "john@acme.example.com" },
      ],
    );
    assert.deepEqual(mapping, {
      "jane doe": "member-1",
      "JOHN@ACME.EXAMPLE.COM": "member-2",
    });
  });

  it("preselects the only workspace member for every name", () => {
    const mapping = suggestTeamMemberMapping(
      ["Jane Doe", "John Smith", "Alex"],
      [{ id: "member-1", name: "Avik Ghosh", email: "avik@acme.example.com" }],
    );
    assert.deepEqual(mapping, {
      "Jane Doe": "member-1",
      "John Smith": "member-1",
      "Alex": "member-1",
    });
  });

  it("leaves unmatched names unmapped when multiple members exist", () => {
    const mapping = suggestTeamMemberMapping(
      ["Jane Doe", "Alex"],
      [
        { id: "member-1", name: "Jane Doe", email: "jane@acme.example.com" },
        { id: "member-2", name: "John Smith", email: "john@acme.example.com" },
      ],
    );
    assert.deepEqual(mapping, { "Jane Doe": "member-1" });
  });
});

describe("parseCsvHours", () => {
  it("parses decimal hours", () => {
    assert.equal(parseCsvHours("8"), 8);
    assert.equal(parseCsvHours("8.5"), 8.5);
    assert.equal(parseCsvHours("8,5"), 8.5);
  });
  it("rejects invalid hours", () => {
    assert.equal(parseCsvHours(""), null);
    assert.equal(parseCsvHours("abc"), null);
    assert.equal(parseCsvHours("8.123"), null);
  });
});

describe("parseCsvDate", () => {
  it("parses ISO dates", () => {
    const date = parseCsvDate("2026-01-15");
    assert.ok(date);
    assert.equal(date.toISOString(), "2026-01-15T00:00:00.000Z");
  });
  it("parses common date formats", () => {
    assert.ok(parseCsvDate("01/15/2026"));
    assert.ok(parseCsvDate("15.01.2026"));
  });
  it("rejects invalid dates", () => {
    assert.equal(parseCsvDate(""), null);
    assert.equal(parseCsvDate("not-a-date"), null);
    assert.equal(parseCsvDate("2026-02-31"), null);
  });
});
