import { EMAIL_REGEX, WEBSITE_REGEX } from "@/lib/clients";
import {
  normalizeClientName,
  type ImportRefs,
  type ImportSpec,
  type ImportValidation,
} from "@/lib/imports/types";

const CLIENT_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"];

export const CLIENT_IMPORT_SPEC: ImportSpec = {
  kind: "clients",
  entityLabel: "client",
  entityLabelPlural: "clients",
  title: "Import clients",
  description:
    "Upload a CSV of clients to create them in bulk. Company names already in this workspace are skipped.",
  templateFilename: "pace-client-template.csv",
  templateColumns: [
    "Company Name",
    "Website",
    "Primary Contact",
    "Contact Email",
    "Phone",
    "Status",
    "Notes",
  ],
  templateSample: [
    "Acme Corp",
    "https://acme.example.com",
    "Jane Doe",
    "jane@acme.example.com",
    "+1 555 0100",
    "ACTIVE",
    "Design retainer",
  ],
  fields: [
    {
      key: "name",
      label: "Company Name",
      required: true,
      keywords: ["company", "client", "name", "customer", "account", "org", "organisation", "organization"],
    },
    {
      key: "website",
      label: "Website",
      required: false,
      keywords: ["website", "url", "site", "web", "domain"],
    },
    {
      key: "contactName",
      label: "Primary Contact",
      required: false,
      keywords: ["contact", "primary", "person", "name", "owner", "contactname", "accountmanager"],
    },
    {
      key: "contactEmail",
      label: "Contact Email",
      required: false,
      keywords: ["email", "contactemail", "mail", "address"],
    },
    {
      key: "phone",
      label: "Phone",
      required: false,
      keywords: ["phone", "telephone", "tel", "mobile", "number"],
    },
    {
      key: "status",
      label: "Status",
      required: false,
      keywords: ["status", "state"],
    },
    {
      key: "notes",
      label: "Notes",
      required: false,
      keywords: ["notes", "note", "description", "comments", "comment", "details"],
    },
  ],
  validate: validateClientImportRow,
};

function validateClientImportRow(
  values: Record<string, string>,
  refs: ImportRefs,
): ImportValidation {
  const errors: ImportValidation["errors"] = [];
  const name = values.name?.trim() ?? "";

  if (!name) {
    errors.push({ field: "name", message: "Company name is required." });
  } else if (name.length > 120) {
    errors.push({ field: "name", message: "Company name must be 120 characters or fewer." });
  } else if (
    refs.existingClientNames?.some(
      (existing) =>
        normalizeClientName(existing) === normalizeClientName(name),
    )
  ) {
    errors.push({ field: "name", message: `"${name}" already exists in this workspace.` });
  }

  const website = values.website?.trim() ?? "";
  if (website && !WEBSITE_REGEX.test(website)) {
    errors.push({ field: "website", message: "Enter a valid website URL." });
  }

  const contactName = values.contactName?.trim() ?? "";
  if (contactName.length > 120) {
    errors.push({ field: "contactName", message: "Contact name must be 120 characters or fewer." });
  }

  const contactEmail = values.contactEmail?.trim() ?? "";
  if (contactEmail && !EMAIL_REGEX.test(contactEmail)) {
    errors.push({ field: "contactEmail", message: "Enter a valid email address." });
  }
  if (contactEmail.length > 254) {
    errors.push({ field: "contactEmail", message: "Contact email must be 254 characters or fewer." });
  }

  const phone = values.phone?.trim() ?? "";
  if (phone.length > 40) {
    errors.push({ field: "phone", message: "Phone must be 40 characters or fewer." });
  }

  const rawStatus = values.status?.trim()?.toUpperCase() ?? "";
  let status = "ACTIVE";
  if (rawStatus) {
    if (CLIENT_STATUSES.includes(rawStatus)) {
      status = rawStatus;
    } else {
      errors.push({
        field: "status",
        message: 'Status must be ACTIVE, PAUSED, or ARCHIVED.',
      });
    }
  }

  const notes = values.notes?.trim() ?? "";
  if (notes.length > 2000) {
    errors.push({ field: "notes", message: "Notes must be 2000 characters or fewer." });
  }

  if (errors.length > 0) {
    return { resolved: null, errors };
  }

  return {
    resolved: {
      name,
      website: website || null,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      phone: phone || null,
      status,
      notes: notes || null,
    },
    errors,
  };
}