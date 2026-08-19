import { z } from "zod";
import type { ClientStatus } from "@/lib/generated/prisma/enums";

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const WEBSITE_REGEX = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/[^\s]*)?$/i;

export const clientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Company name is required.")
    .max(120, "Company name must be 120 characters or fewer."),
  company: z
    .string()
    .trim()
    .max(120, "Company must be 120 characters or fewer.")
    .optional(),
  website: z
    .string()
    .trim()
    .max(2048, "Website must be 2048 characters or fewer.")
    .optional()
    .refine((value) => !value || WEBSITE_REGEX.test(value), "Enter a valid website URL."),
  contactName: z
    .string()
    .trim()
    .max(120, "Contact name must be 120 characters or fewer.")
    .optional(),
  contactEmail: z
    .string()
    .trim()
    .max(254, "Contact email must be 254 characters or fewer.")
    .optional()
    .refine((value) => !value || EMAIL_REGEX.test(value), "Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .max(40, "Phone must be 40 characters or fewer.")
    .optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be 2000 characters or fewer.")
    .optional(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export type ClientRow = {
  id: string;
  name: string;
  company: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  status: ClientStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const clientSelect = {
  id: true,
  workspaceId: true,
  name: true,
  company: true,
  website: true,
  contactName: true,
  contactEmail: true,
  phone: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const CLIENT_STATUS_OPTIONS: ReadonlyArray<{
  value: ClientStatus;
  label: string;
}> = [
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "ARCHIVED", label: "Archived" },
];

export function clientStatusLabel(status: ClientStatus): string {
  return CLIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function clientFormDefaults(): ClientFormValues {
  return {
    name: "",
    company: "",
    website: "",
    contactName: "",
    contactEmail: "",
    phone: "",
    status: "ACTIVE",
    notes: "",
  };
}

export function clientFormFromRow(row: ClientRow): ClientFormValues {
  return {
    name: row.name,
    company: row.company ?? "",
    website: row.website ?? "",
    contactName: row.contactName ?? "",
    contactEmail: row.contactEmail ?? "",
    phone: row.phone ?? "",
    status: row.status,
    notes: row.notes ?? "",
  };
}
