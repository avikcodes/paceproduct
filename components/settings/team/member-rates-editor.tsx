"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { updateMemberRates } from "@/app/(app)/settings/team/actions";
import {
  CURRENCY_ITEMS,
  CURRENCY_OPTIONS,
  currencySymbol,
} from "@/lib/retainers";
import {
  memberRatesFormSchema,
  memberRatesFromRow,
  type MemberRatesFormValues,
  type MemberRatesRow,
} from "@/lib/member-rates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MemberRatesEditorProps = {
  memberId: string;
  row: MemberRatesRow;
  onCancel: () => void;
};

export function MemberRatesEditor({
  memberId,
  row,
  onCancel,
}: MemberRatesEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MemberRatesFormValues>({
    resolver: zodResolver(memberRatesFormSchema),
    defaultValues: memberRatesFromRow(row),
  });

  const { errors } = form.formState;
  const watchedCurrency =
    useWatch({ control: form.control, name: "currency" }) ?? "USD";

  async function onSubmit(values: MemberRatesFormValues) {
    setIsSubmitting(true);
    const result = await updateMemberRates(memberId, values);
    if (result.error) {
      toast.error(result.error);
    } else if (result.success) {
      toast.success(result.success);
      onCancel();
    }
    setIsSubmitting(false);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2 sm:w-44">
          <Label htmlFor={`${memberId}-billing`}>Billing rate</Label>
          <div className="relative">
            <span
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              {currencySymbol(watchedCurrency)}
            </span>
            <Input
              id={`${memberId}-billing`}
              inputMode="decimal"
              placeholder="0.00"
              disabled={isSubmitting}
              className="pl-8"
              aria-invalid={Boolean(errors.billingRate)}
              aria-describedby={
                errors.billingRate ? `${memberId}-billing-error` : undefined
              }
              {...form.register("billingRate")}
            />
          </div>
          {errors.billingRate?.message && (
            <p
              id={`${memberId}-billing-error`}
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.billingRate.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:w-44">
          <Label htmlFor={`${memberId}-cost`}>Internal cost rate</Label>
          <div className="relative">
            <span
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              {currencySymbol(watchedCurrency)}
            </span>
            <Input
              id={`${memberId}-cost`}
              inputMode="decimal"
              placeholder="0.00"
              disabled={isSubmitting}
              className="pl-8"
              aria-invalid={Boolean(errors.costRate)}
              aria-describedby={
                errors.costRate ? `${memberId}-cost-error` : undefined
              }
              {...form.register("costRate")}
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
              / hr
            </span>
          </div>
          {errors.costRate?.message && (
            <p
              id={`${memberId}-cost-error`}
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.costRate.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:w-44">
          <Label htmlFor={`${memberId}-currency`}>Currency</Label>
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
                items={CURRENCY_ITEMS}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Currency"
                  id={`${memberId}-currency`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex gap-2 sm:ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X />
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Check />
            )}
            Save
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Rates are per hour and shown in the workspace currency. Enter a number
        greater than or equal to 0 (for example 40 = $40/hour).
      </p>
    </form>
  );
}
