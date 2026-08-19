import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { BillingCycle } from "@/lib/generated/prisma/enums";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const CURRENCY_CODES = [
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "INR",
  "JPY",
  "SGD",
  "CHF",
  "NZD",
  "AED",
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const CURRENCY_OPTIONS: ReadonlyArray<{
  value: CurrencyCode;
  label: string;
}> = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
  { value: "CHF", label: "CHF — Swiss Franc" },
  { value: "NZD", label: "NZD — New Zealand Dollar" },
  { value: "AED", label: "AED — UAE Dirham" },
];

export const CURRENCY_ITEMS: Record<string, string> = Object.fromEntries(
  CURRENCY_CODES.map((code) => [code, code]),
);

export const BILLING_CYCLE_OPTIONS: ReadonlyArray<{
  value: BillingCycle;
  label: string;
}> = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

export const BILLING_CYCLE_ITEMS: Record<string, string> = Object.fromEntries(
  BILLING_CYCLE_OPTIONS.map((option) => [option.value, option.label]),
);

/**
 * Number of months each billing cycle covers. A retainer amount is the total
 * billed per billing cycle, so the monthly revenue contribution is the
 * amount divided by this factor.
 */
export const BILLING_CYCLE_MONTHS: Readonly<Record<BillingCycle, number>> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

export function billingCycleMonths(cycle: BillingCycle): number {
  return BILLING_CYCLE_MONTHS[cycle] ?? 1;
}

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Monthly revenue a retainer contributes given its total billed amount per
 * billing cycle. A quarterly $9,000 retainer contributes $3,000/month and a
 * yearly $36,000 retainer contributes $3,000/month.
 */
export function retainerMonthlyAmount(
  amount: number,
  cycle: BillingCycle,
): number {
  return roundToTwo(amount / billingCycleMonths(cycle));
}

export const BILLING_CYCLE_RATE_LABELS: Readonly<Record<BillingCycle, string>> =
  {
    MONTHLY: "/month",
    QUARTERLY: "/quarter",
    YEARLY: "/year",
  };

export function billingCycleRateLabel(cycle: BillingCycle): string {
  return BILLING_CYCLE_RATE_LABELS[cycle] ?? "/month";
}

export const BILLING_CYCLE_PERIOD_LABELS: Readonly<
  Record<BillingCycle, string>
> = {
  MONTHLY: "per month",
  QUARTERLY: "per quarter",
  YEARLY: "per year",
};

export function billingCyclePeriodLabel(cycle: BillingCycle): string {
  return BILLING_CYCLE_PERIOD_LABELS[cycle] ?? "per month";
}

export function isValidDateString(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime());
}

export const retainerFormSchema = z
  .object({
    monthlyBudget: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount.")
      .refine((value) => Number(value) > 0, "Retainer amount must be greater than 0.")
      .refine((value) => Number(value) <= 999999999.99, "Retainer amount is too large."),
    currency: z.enum(CURRENCY_CODES),
    billingCycle: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
    scopeHours: z
      .number("Enter a valid number of hours.")
      .int("Enter a whole number.")
      .min(0, "Scope hours can't be negative.")
      .max(1000, "Scope hours must be 1000 or fewer."),
    startDate: z
      .string()
      .min(1, "Start date is required.")
      .refine(isValidDateString, "Enter a valid start date."),
    endDate: z
      .string()
      .optional()
      .refine((value) => !value || isValidDateString(value), "Enter a valid end date."),
  })
  .superRefine((values, ctx) => {
    if (values.endDate && values.startDate && values.endDate < values.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be after the start date.",
      });
    }
  });

export type RetainerFormValues = z.infer<typeof retainerFormSchema>;

export type RetainerRow = {
  id: string;
  clientId: string;
  monthlyBudget: number;
  currency: string;
  billingCycle: BillingCycle;
  scopeHours: number;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const retainerSelect = {
  id: true,
  clientId: true,
  monthlyBudget: true,
  currency: true,
  billingCycle: true,
  scopeHours: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type RetainerSelectPayload = Prisma.RetainerGetPayload<{
  select: typeof retainerSelect;
}>;

export function toRetainerRow(retainer: RetainerSelectPayload): RetainerRow {
  return {
    ...retainer,
    monthlyBudget: retainer.monthlyBudget.toNumber(),
  };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function currencySymbol(currency: string): string {
  try {
    const part = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find(({ type }) => type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

export function billingCycleLabel(cycle: BillingCycle): string {
  return BILLING_CYCLE_OPTIONS.find((option) => option.value === cycle)?.label ?? cycle;
}

export function formatRetainerDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function dateToInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function retainerFormDefaults(): RetainerFormValues {
  return {
    monthlyBudget: "",
    currency: "USD",
    billingCycle: "MONTHLY",
    scopeHours: 40,
    startDate: "",
    endDate: "",
  };
}

export function retainerFormFromRow(row: RetainerRow): RetainerFormValues {
  return {
    monthlyBudget: row.monthlyBudget.toFixed(2),
    currency: row.currency as CurrencyCode,
    billingCycle: row.billingCycle,
    scopeHours: row.scopeHours,
    startDate: dateToInputValue(row.startDate),
    endDate: row.endDate ? dateToInputValue(row.endDate) : "",
  };
}
