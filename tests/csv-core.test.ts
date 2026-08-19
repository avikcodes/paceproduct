import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  autoMapColumns,
  normalizeHeader,
  validateMappings,
  type CsvFieldDef,
  type Mapping,
} from "@/lib/csv-core";
import { TIME_ENTRY_FIELD_DEFS } from "@/lib/time-import";
import { CLIENT_IMPORT_SPEC } from "@/lib/imports/clients";
import { RETAINER_IMPORT_SPEC } from "@/lib/imports/retainers";
import { TEAM_IMPORT_SPEC } from "@/lib/imports/team";

function timeEntryMap(columns: string[]): Mapping {
  return autoMapColumns(columns, TIME_ENTRY_FIELD_DEFS);
}

function expectTimeEntryColumns(mapping: Mapping, columns: string[]): void {
  const nameOf = (field: string) => {
    const column = mapping[field];
    assert.ok(column, `${field} should be mapped`);
    return normalizeHeader(column);
  };
  assert.equal(nameOf("client"), "client");
  assert.equal(nameOf("member"), "teammember");
  assert.equal(nameOf("task"), "task");
  assert.equal(nameOf("hours"), "hours");
  assert.equal(nameOf("date"), "workdate");
  for (const column of columns) {
    const normalized = normalizeHeader(column);
    if (!["client", "teammember", "task", "hours", "workdate"].includes(normalized)) {
      continue;
    }
    assert.ok(
      Object.values(mapping).includes(column),
      `column "${column}" should be used by exactly one field`,
    );
  }
}

describe("normalizeHeader", () => {
  it("ignores case, spacing, hyphens, underscores and punctuation", () => {
    for (const variant of [
      "Team Member",
      "team member",
      "TEAM_MEMBER",
      "team-member",
      "teamMember",
      "  Team   Member  ",
      "T E A M M E M B E R",
    ]) {
      assert.equal(normalizeHeader(variant), "teammember");
    }
    assert.equal(normalizeHeader("Work Date"), "workdate");
    assert.equal(normalizeHeader("Monthly-Budget"), "monthlybudget");
    assert.equal(normalizeHeader("Company_Name"), "companyname");
  });
});

describe("autoMapColumns — time entries", () => {
  it("maps perfect headers", () => {
    const mapping = timeEntryMap([
      "Client",
      "Team Member",
      "Task",
      "Hours",
      "Work Date",
    ]);
    assert.deepEqual(mapping, {
      client: "Client",
      member: "Team Member",
      task: "Task",
      hours: "Hours",
      date: "Work Date",
    });
  });

  it("maps different casing", () => {
    const mapping = timeEntryMap([
      "client",
      "team member",
      "task",
      "hours",
      "work date",
    ]);
    assert.deepEqual(mapping, {
      client: "client",
      member: "team member",
      task: "task",
      hours: "hours",
      date: "work date",
    });
  });

  it("maps extra whitespace", () => {
    const mapping = timeEntryMap([
      "  Client  ",
      " Team Member ",
      "Task",
      "Hours",
      "Work Date",
    ]);
    expectTimeEntryColumns(mapping, [
      "  Client  ",
      " Team Member ",
      "Task",
      "Hours",
      "Work Date",
    ]);
    assert.equal(mapping.client, "  Client  ");
    assert.equal(mapping.member, " Team Member ");
  });

  it("maps underscores", () => {
    const mapping = timeEntryMap([
      "Client",
      "Team_Member",
      "Task",
      "Hours",
      "Work_Date",
    ]);
    assert.equal(mapping.member, "Team_Member");
    assert.equal(mapping.date, "Work_Date");
    expectTimeEntryColumns(mapping, [
      "Client",
      "Team_Member",
      "Task",
      "Hours",
      "Work_Date",
    ]);
  });

  it("maps hyphens", () => {
    const mapping = timeEntryMap([
      "Client",
      "Team-Member",
      "Task",
      "Hours",
      "Work-Date",
    ]);
    assert.equal(mapping.member, "Team-Member");
    assert.equal(mapping.date, "Work-Date");
    expectTimeEntryColumns(mapping, [
      "Client",
      "Team-Member",
      "Task",
      "Hours",
      "Work-Date",
    ]);
  });

  it("maps camelCase headers", () => {
    const mapping = timeEntryMap([
      "Client",
      "teamMember",
      "Task",
      "Hours",
      "workDate",
    ]);
    assert.equal(mapping.member, "teamMember");
    assert.equal(mapping.date, "workDate");
    expectTimeEntryColumns(mapping, [
      "Client",
      "teamMember",
      "Task",
      "Hours",
      "workDate",
    ]);
  });

  it("maps reordered columns by name, not position", () => {
    const mapping = timeEntryMap([
      "Hours",
      "Task",
      "Team Member",
      "Client",
      "Work Date",
    ]);
    assert.deepEqual(mapping, {
      client: "Client",
      member: "Team Member",
      task: "Task",
      hours: "Hours",
      date: "Work Date",
    });
  });

  it("ignores additional unknown columns", () => {
    const mapping = timeEntryMap([
      "Client",
      "Team Member",
      "Task",
      "Hours",
      "Work Date",
      "Department",
      "Notes",
      "Manager",
    ]);
    assert.deepEqual(mapping, {
      client: "Client",
      member: "Team Member",
      task: "Task",
      hours: "Hours",
      date: "Work Date",
    });
  });

  it("leaves missing optional columns unmapped", () => {
    const mapping = timeEntryMap(["Client", "Team Member", "Hours", "Work Date"]);
    assert.equal(mapping.client, "Client");
    assert.equal(mapping.member, "Team Member");
    assert.equal(mapping.task, null);
    assert.equal(mapping.hours, "Hours");
    assert.equal(mapping.date, "Work Date");
  });

  it("leaves missing required columns unmapped", () => {
    const mapping = timeEntryMap(["Client", "Task", "Hours", "Work Date"]);
    assert.equal(mapping.client, "Client");
    assert.equal(mapping.member, null);
    assert.equal(mapping.task, "Task");
    assert.equal(mapping.hours, "Hours");
    assert.equal(mapping.date, "Work Date");
  });

  it("maps a Toggl-style export", () => {
    const mapping = timeEntryMap([
      "Description",
      "Project",
      "User",
      "Duration",
      "Start date",
    ]);
    assert.equal(mapping.task, "Description");
    assert.equal(mapping.member, "User");
    assert.equal(mapping.hours, "Duration");
    assert.equal(mapping.date, "Start date");
    assert.equal(mapping.client, null);
  });

  it("never maps the same column twice", () => {
    const mapping = timeEntryMap(["Task", "Task", "Hours"]);
    const values = Object.values(mapping).filter(Boolean);
    assert.equal(new Set(values).size, values.length);
  });
});

describe("autoMapColumns — client import", () => {
  it("maps the client template headers", () => {
    const mapping = autoMapColumns(
      CLIENT_IMPORT_SPEC.templateColumns,
      CLIENT_IMPORT_SPEC.fields,
    );
    assert.equal(mapping.name, "Company Name");
    assert.equal(mapping.website, "Website");
    assert.equal(mapping.contactName, "Primary Contact");
    assert.equal(mapping.contactEmail, "Contact Email");
    assert.equal(mapping.phone, "Phone");
    assert.equal(mapping.status, "Status");
    assert.equal(mapping.notes, "Notes");
  });

  it("maps case/space variants of client headers", () => {
    const mapping = autoMapColumns(
      ["company", "Website", "Primary contact", "email", "Phone", "STATUS"],
      CLIENT_IMPORT_SPEC.fields,
    );
    assert.equal(mapping.name, "company");
    assert.equal(mapping.website, "Website");
    assert.equal(mapping.contactName, "Primary contact");
    assert.equal(mapping.contactEmail, "email");
    assert.equal(mapping.phone, "Phone");
    assert.equal(mapping.status, "STATUS");
    assert.equal(mapping.notes, null);
  });

  it("maps the retainer template headers", () => {
    const mapping = autoMapColumns(
      RETAINER_IMPORT_SPEC.templateColumns,
      RETAINER_IMPORT_SPEC.fields,
    );
    assert.equal(mapping.client, "Client");
    assert.equal(mapping.monthlyBudget, "Retainer Amount");
    assert.equal(mapping.currency, "Currency");
    assert.equal(mapping.billingCycle, "Billing Cycle");
    assert.equal(mapping.scopeHours, "Scope Hours");
    assert.equal(mapping.startDate, "Start Date");
    assert.equal(mapping.endDate, "End Date");
  });

  it("maps the team template headers", () => {
    const mapping = autoMapColumns(
      TEAM_IMPORT_SPEC.templateColumns,
      TEAM_IMPORT_SPEC.fields,
    );
    assert.equal(mapping.email, "Email");
    assert.equal(mapping.role, "Role");
  });

  it("maps lowercase team headers", () => {
    const mapping = autoMapColumns(["email", "role"], TEAM_IMPORT_SPEC.fields);
    assert.equal(mapping.email, "email");
    assert.equal(mapping.role, "role");
  });
});

describe("validateMappings", () => {
  const fields: CsvFieldDef[] = TIME_ENTRY_FIELD_DEFS;

  it("accepts a complete mapping", () => {
    const issues = validateMappings(
      {
        client: "Client",
        member: "Team Member",
        task: "Task",
        hours: "Hours",
        date: "Work Date",
      },
      fields,
      ["Client", "Team Member", "Task", "Hours", "Work Date"],
    );
    assert.deepEqual(issues, []);
  });

  it("reports a required field that is not mapped", () => {
    const issues = validateMappings(
      {
        client: "Client",
        member: null,
        task: "Task",
        hours: "Hours",
        date: "Work Date",
      },
      fields,
    );
    assert.deepEqual(issues, [
      { field: "member", message: "Team member column is not mapped." },
    ]);
  });

  it("reports multiple unmapped required fields", () => {
    const issues = validateMappings(
      {
        client: "Client",
        member: "Team Member",
        task: null,
        hours: "Hours",
        date: null,
      },
      fields,
    );
    assert.deepEqual(issues, [
      { field: "task", message: "Task column is not mapped." },
      { field: "date", message: "Date column is not mapped." },
    ]);
  });

  it("reports a mapped column that is not in the file", () => {
    const issues = validateMappings(
      {
        client: "Client",
        member: "NotThere",
        task: "Task",
        hours: "Hours",
        date: "Work Date",
      },
      fields,
      ["Client", "Task", "Hours", "Work Date"],
    );
    assert.deepEqual(issues, [
      { field: "member", message: 'Column "NotThere" was not found in the file.' },
    ]);
  });

  it("reports a column mapped to two fields", () => {
    const issues = validateMappings(
      {
        client: "Client",
        member: "Team Member",
        task: "Team Member",
        hours: "Hours",
        date: "Work Date",
      },
      fields,
    );
    assert.deepEqual(issues, [
      {
        field: "task",
        message: 'The "Team Member" column is already mapped to another field.',
      },
    ]);
  });

  it("reports every required field when mapping is null", () => {
    const issues = validateMappings(null, fields);
    assert.deepEqual(issues, [
      { field: "client", message: "Client column is not mapped." },
      { field: "member", message: "Team member column is not mapped." },
      { field: "task", message: "Task column is not mapped." },
      { field: "hours", message: "Hours column is not mapped." },
      { field: "date", message: "Date column is not mapped." },
    ]);
  });

  it("does not require optional fields", () => {
    const issues = validateMappings(
      {
        client: "Client",
        member: "Team Member",
        task: null,
        hours: "Hours",
        date: "Work Date",
      },
      CLIENT_IMPORT_SPEC.fields.map((field) => ({
        ...field,
        required: false,
      })),
    );
    assert.deepEqual(issues, []);
  });
});
