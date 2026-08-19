import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { TimeEntrySource } from "@/lib/generated/prisma/enums";
import { dateToInputValue, isValidDateString } from "@/lib/retainers";

const HOURS_REGEX = /^\d+(\.\d{1,2})?$/;

export const timeEntryFormSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  memberId: z.string().min(1, "Team member is required."),
  task: z
    .string()
    .trim()
    .min(1, "Task is required.")
    .max(300, "Task must be 300 characters or fewer."),
  hours: z
    .string()
    .trim()
    .regex(HOURS_REGEX, "Enter a valid number of hours.")
    .refine((value) => Number(value) > 0, "Hours must be greater than 0.")
    .refine((value) => Number(value) <= 24, "Hours must be 24 or fewer."),
  workDate: z
    .string()
    .min(1, "Work date is required.")
    .refine(isValidDateString, "Enter a valid work date."),
});

export type TimeEntryFormValues = z.infer<typeof timeEntryFormSchema>;

export type TimeEntryRow = {
  id: string;
  clientId: string;
  clientName: string;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  task: string;
  hours: number;
  workDate: Date;
  source: TimeEntrySource;
  createdAt: Date;
  updatedAt: Date;
};

export const timeEntrySelect = {
  id: true,
  workspaceId: true,
  clientId: true,
  client: { select: { name: true } },
  memberId: true,
  task: true,
  hours: true,
  workDate: true,
  source: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type TimeEntrySelectPayload = Prisma.TimeEntryGetPayload<{
  select: typeof timeEntrySelect;
}>;

export type MemberDisplay = {
  name: string | null;
  email: string | null;
};

export type ClientOption = { id: string; name: string };
export type MemberOption = {
  id: string;
  name: string | null;
  email: string | null;
};

export function memberLabel(member: MemberOption): string {
  return member.name ?? member.email ?? "Unnamed member";
}

export function toTimeEntryRow(
  entry: TimeEntrySelectPayload,
  member: MemberDisplay,
): TimeEntryRow {
  return {
    id: entry.id,
    clientId: entry.clientId,
    clientName: entry.client.name,
    memberId: entry.memberId,
    memberName: member.name ?? "Unnamed member",
    memberEmail: member.email,
    task: entry.task,
    hours: entry.hours.toNumber(),
    workDate: entry.workDate,
    source: entry.source,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export const SOURCE_OPTIONS: ReadonlyArray<{
  value: TimeEntrySource;
  label: string;
}> = [
  { value: "MANUAL", label: "Manual" },
  { value: "CSV", label: "CSV" },
  { value: "TOGGL", label: "Toggl" },
  { value: "HARVEST", label: "Harvest" },
];

export function sourceLabel(source: TimeEntrySource): string {
  return SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source;
}

export function formatHours(hours: number): string {
  const value = Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(2);
  return `${value} hrs`;
}

export function formatWorkDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function timeEntryFormDefaults(): TimeEntryFormValues {
  return {
    clientId: "",
    memberId: "",
    task: "",
    hours: "",
    workDate: todayInputValue(),
  };
}

export function timeEntryFormFromRow(row: TimeEntryRow): TimeEntryFormValues {
  return {
    clientId: row.clientId,
    memberId: row.memberId,
    task: row.task,
    hours: row.hours.toFixed(row.hours % 1 === 0 ? 0 : 2),
    workDate: dateToInputValue(row.workDate),
  };
}
