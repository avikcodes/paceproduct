import { z } from "zod";
import {
  DEFAULT_MARGIN_THRESHOLDS,
  type MarginThresholds,
} from "@/lib/margin-status";

const DECIMAL_REGEX = /^-?\d+(\.\d{1,2})?$/;
const THRESHOLD_MIN = -100;
const THRESHOLD_MAX = 100;

function thresholdField() {
  return z
    .string()
    .trim()
    .regex(DECIMAL_REGEX, "Enter a valid percentage.")
    .refine(
      (value) => {
        const number = Number(value);
        return number >= THRESHOLD_MIN && number <= THRESHOLD_MAX;
      },
      `Enter a value between ${THRESHOLD_MIN}% and ${THRESHOLD_MAX}%.`,
    );
}

export const marginThresholdsFormSchema = z
  .object({
    healthy: thresholdField(),
    warning: thresholdField(),
    critical: thresholdField(),
  })
  .refine(
    (values) => Number(values.healthy) >= Number(values.warning),
    {
      path: ["warning"],
      message: "Warning % must be less than or equal to Healthy %.",
    },
  )
  .refine(
    (values) => Number(values.warning) >= Number(values.critical),
    {
      path: ["critical"],
      message: "Critical % must be less than or equal to Warning %.",
    },
  );

export type MarginThresholdsFormValues = z.infer<
  typeof marginThresholdsFormSchema
>;

export function marginThresholdsFormDefaults(
  thresholds: MarginThresholds = DEFAULT_MARGIN_THRESHOLDS,
): MarginThresholdsFormValues {
  return {
    healthy: String(thresholds.healthy),
    warning: String(thresholds.warning),
    critical: String(thresholds.critical),
  };
}
