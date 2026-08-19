import { CURRENCY_CODES } from "@/lib/retainers";
import {
  normalizeClientName,
  type ImportRefs,
  type ImportSpec,
  type ImportValidation,
} from "@/lib/imports/types";

const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "YEARLY"];

function normalizeCurrency(value: string): string {
  const code = value.trim().toUpperCase();
  return CURRENCY_CODES.includes(code as (typeof CURRENCY_CODES)[number])
    ? code
    : "USD";
}

export const RETAINER_IMPORT_SPEC: ImportSpec = {
  kind: "retainers",
  entityLabel: "retainer",
  entityLabelPlural: "retainers",
  title: "Import retainers",
  description:
    "Upload a CSV of retainers to attach them to existing clients. Clients are matched by name.",
  templateFilename: "pace-retainer-template.csv",
  templateColumns: [
    "Client",
    "Retainer Amount",
    "Currency",
    "Billing Cycle",
    "Scope Hours",
    "Start Date",
    "End Date",
  ],
  templateSample: [
    "Acme Corp",
    "10000",
    "USD",
    "MONTHLY",
    "120",
    "2026-01-01",
    "2026-12-31",
  ],
  fields: [
    {
      key: "client",
      label: "Client",
      required: true,
      keywords: ["client", "customer", "company", "account", "org", "organisation", "organization", "name"],
    },
    {
      key: "monthlyBudget",
      label: "Retainer Amount",
      required: true,
      keywords: ["monthly", "budget", "monthlybudget", "retainer", "amount", "revenue", "fee"],
    },
    {
      key: "currency",
      label: "Currency",
      required: false,
      keywords: ["currency", "ccy", "code"],
    },
    {
      key: "billingCycle",
      label: "Billing Cycle",
      required: false,
      keywords: ["billing", "cycle", "billingcycle", "cadence", "frequency", "period"],
    },
    {
      key: "scopeHours",
      label: "Scope Hours",
      required: false,
      keywords: ["scope", "hours", "scopehours", "scope hours", "hoursincluded", "includedhours"],
    },
    {
      key: "startDate",
      label: "Start Date",
      required: true,
      keywords: ["start", "startdate", "start date", "from", "begins", "effective"],
    },
    {
      key: "endDate",
      label: "End Date",
      required: false,
      keywords: ["end", "enddate", "end date", "to", "until", "expires"],
    },
  ],
  validate: validateRetainerImportRow,
};

function parseAmount(value: string): number | null {
  const input = value.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(input)) return null;
  const amount = Number(input);
  return Number.isFinite(amount) ? amount : null;
}

function parseDate(value: string): string | null {
  const input = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : input;
}

export function validateRetainerImportRow(
  values: Record<string, string>,
  refs: ImportRefs,
): ImportValidation {
  const errors: ImportValidation["errors"] = [];
  const clientName = values.client?.trim() ?? "";

  const client = refs.clients?.find(
    (candidate) =>
      normalizeClientName(candidate.name) === normalizeClientName(clientName),
  );

  if (!clientName) {
    errors.push({ field: "client", message: "Client is required." });
  } else if (!client) {
    errors.push({ field: "client", message: `No client found for "${clientName}".` });
  } else if (
    refs.existingActiveClients?.includes(client.id) &&
    values.startDate?.trim()
  ) {
    errors.push({
      field: "client",
      message: `"${clientName}" already has an active retainer.`,
    });
  }

  const monthlyBudget = parseAmount(values.monthlyBudget ?? "");
  if (!values.monthlyBudget?.trim()) {
    errors.push({ field: "monthlyBudget", message: "Retainer amount is required." });
  } else if (monthlyBudget === null) {
    errors.push({ field: "monthlyBudget", message: "Enter a valid amount." });
  } else if (monthlyBudget <= 0) {
    errors.push({ field: "monthlyBudget", message: "Retainer amount must be greater than 0." });
  } else if (monthlyBudget > 999999999.99) {
    errors.push({ field: "monthlyBudget", message: "Retainer amount is too large." });
  }

  const rawCycle = values.billingCycle?.trim()?.toUpperCase() ?? "";
  let billingCycle = "MONTHLY";
  if (rawCycle) {
    if (BILLING_CYCLES.includes(rawCycle)) {
      billingCycle = rawCycle;
    } else {
      errors.push({
        field: "billingCycle",
        message: "Billing cycle must be MONTHLY, QUARTERLY, or YEARLY.",
      });
    }
  }

  let scopeHours = 0;
  const rawScope = values.scopeHours?.trim() ?? "";
  if (rawScope) {
    if (!/^\d+$/.test(rawScope)) {
      errors.push({ field: "scopeHours", message: "Enter a whole number of hours." });
    } else {
      scopeHours = Number(rawScope);
      if (scopeHours < 0) {
        errors.push({ field: "scopeHours", message: "Scope hours can't be negative." });
      } else if (scopeHours > 1000) {
        errors.push({ field: "scopeHours", message: "Scope hours must be 1000 or fewer." });
      }
    }
  }

  const startDate = parseDate(values.startDate ?? "");
  if (!values.startDate?.trim()) {
    errors.push({ field: "startDate", message: "Start date is required." });
  } else if (!startDate) {
    errors.push({ field: "startDate", message: "Enter a valid start date (e.g. 2026-01-31)." });
  }

  let endDate: string | null = null;
  const rawEnd = values.endDate?.trim() ?? "";
  if (rawEnd) {
    const parsedEnd = parseDate(rawEnd);
    if (!parsedEnd) {
      errors.push({ field: "endDate", message: "Enter a valid end date (e.g. 2026-12-31)." });
    } else {
      endDate = parsedEnd;
      if (startDate && parsedEnd < startDate) {
        errors.push({ field: "endDate", message: "End date must be after the start date." });
      }
    }
  }

  if (errors.length > 0 || !client || monthlyBudget === null || !startDate) {
    return { resolved: null, errors };
  }

  return {
    resolved: {
      clientId: client.id,
      monthlyBudget,
      currency: normalizeCurrency(values.currency ?? "USD"),
      billingCycle,
      scopeHours,
      startDate,
      endDate,
    },
    errors,
  };
}