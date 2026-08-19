import type {
  ImportRefs,
  ImportSpec,
  ImportValidation,
} from "@/lib/imports/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["OWNER", "MEMBER"];

export const TEAM_IMPORT_SPEC: ImportSpec = {
  kind: "team",
  entityLabel: "team member",
  entityLabelPlural: "team members",
  title: "Import team members",
  description:
    "Upload a CSV of email addresses to send workspace invitations. Rows for existing members or pending invitations are skipped.",
  templateFilename: "pace-team-template.csv",
  templateColumns: ["Email", "Role"],
  templateSample: ["alex@acme.example.com", "MEMBER"],
  fields: [
    {
      key: "email",
      label: "Email",
      required: true,
      keywords: ["email", "mail", "address", "emailaddress"],
    },
    {
      key: "role",
      label: "Role",
      required: false,
      keywords: ["role", "permission", "level", "access"],
    },
  ],
  validate: validateTeamImportRow,
};

function validateTeamImportRow(
  values: Record<string, string>,
  refs: ImportRefs,
): ImportValidation {
  const errors: ImportValidation["errors"] = [];
  const email = values.email?.trim().toLowerCase() ?? "";

  if (!email) {
    errors.push({ field: "email", message: "Email is required." });
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address." });
  } else if (refs.existingEmails?.includes(email)) {
    errors.push({
      field: "email",
      message: `${email} is already a member or has a pending invitation.`,
    });
  }

  const rawRole = values.role?.trim()?.toUpperCase() ?? "";
  let role = "MEMBER";
  if (rawRole) {
    if (ROLES.includes(rawRole)) {
      role = rawRole;
    } else {
      errors.push({ field: "role", message: "Role must be OWNER or MEMBER." });
    }
  }

  if (errors.length > 0) {
    return { resolved: null, errors };
  }

  return {
    resolved: {
      email,
      role,
    },
    errors,
  };
}