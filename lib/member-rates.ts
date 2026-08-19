import { z } from "zod";
import {
  CURRENCY_CODES,
  type CurrencyCode,
} from "@/lib/retainers";

const DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;
const RATE_MAX = 999999999.99;

export const memberRatesFormSchema = z.object({
  billingRate: z
    .string()
    .trim()
    .regex(DECIMAL_REGEX, "Enter a valid amount.")
    .refine((value) => Number(value) >= 0, "Billing rate can't be negative.")
    .refine((value) => Number(value) <= RATE_MAX, "Billing rate is too large."),
  costRate: z
    .string()
    .trim()
    .regex(DECIMAL_REGEX, "Enter a valid amount.")
    .refine((value) => Number(value) >= 0, "Cost rate can't be negative.")
    .refine((value) => Number(value) <= RATE_MAX, "Cost rate is too large."),
  currency: z.enum(CURRENCY_CODES),
});

export type MemberRatesFormValues = z.infer<typeof memberRatesFormSchema>;

export type MemberRatesRow = {
  billingRate: number;
  costRate: number;
  currency: CurrencyCode;
};

export function memberRatesFromRow(row: MemberRatesRow): MemberRatesFormValues {
  return {
    billingRate: row.billingRate.toFixed(2),
    costRate: row.costRate.toFixed(2),
    currency: row.currency,
  };
}
