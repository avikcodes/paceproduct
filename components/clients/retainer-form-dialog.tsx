"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createRetainer,
  updateRetainer,
} from "@/app/(app)/dashboard/clients/[clientId]/actions";
import {
  BILLING_CYCLE_ITEMS,
  BILLING_CYCLE_OPTIONS,
  billingCyclePeriodLabel,
  CURRENCY_ITEMS,
  CURRENCY_OPTIONS,
  currencySymbol,
  retainerFormDefaults,
  retainerFormFromRow,
  retainerFormSchema,
  type RetainerFormValues,
  type RetainerRow,
} from "@/lib/retainers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RetainerFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  retainer: RetainerRow | null;
  onSaved?: () => void;
};

export function RetainerFormDialog({
  open,
  onOpenChange,
  clientId,
  retainer,
  onSaved,
}: RetainerFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(retainer);

  const form = useForm<RetainerFormValues>({
    resolver: zodResolver(retainerFormSchema),
    defaultValues: retainerFormDefaults(),
  });

  const { errors } = form.formState;
  const watchedCurrency = useWatch({ control: form.control, name: "currency" }) ?? "USD";
  const watchedCycle =
    useWatch({ control: form.control, name: "billingCycle" }) ?? "MONTHLY";

  useEffect(() => {
    if (open) {
      form.reset(retainer ? retainerFormFromRow(retainer) : retainerFormDefaults());
    }
  }, [open, retainer, form]);

  async function onSubmit(values: RetainerFormValues) {
    setIsSubmitting(true);

    const result = isEditing && retainer
      ? await updateRetainer(retainer.id, values)
      : await createRetainer(clientId, values);

    if (result.ok) {
      toast.success(isEditing ? "Retainer updated." : "Retainer created.");
      onOpenChange(false);
      onSaved?.();
    } else {
      toast.error(result.error);
    }

    setIsSubmitting(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit retainer" : "Create retainer"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update this client's recurring budget and scope."
                : "Set up the recurring budget and scope for this client."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="retainer-budget">Retainer amount</Label>
              <div className="relative">
                <span
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
                  aria-hidden="true"
                >
                  {currencySymbol(watchedCurrency)}
                </span>
                <Input
                  id="retainer-budget"
                  inputMode="decimal"
                  placeholder="2500.00"
                  disabled={isSubmitting}
                  className="pl-8"
                  aria-invalid={Boolean(errors.monthlyBudget)}
                  aria-describedby={
                    errors.monthlyBudget ? "retainer-budget-error" : undefined
                  }
                  {...form.register("monthlyBudget")}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Total billed {billingCyclePeriodLabel(watchedCycle)} — revenue
                is applied to each month within the billing cycle.
              </p>
              {errors.monthlyBudget?.message && (
                <p
                  id="retainer-budget-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.monthlyBudget.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="retainer-currency">Currency</Label>
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
                    <SelectTrigger className="w-full" aria-label="Currency">
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="retainer-cycle">Billing cycle</Label>
              <Controller
                control={form.control}
                name="billingCycle"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    items={BILLING_CYCLE_ITEMS}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-full" aria-label="Billing cycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_CYCLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="retainer-hours">Monthly scope hours</Label>
              <Input
                id="retainer-hours"
                type="number"
                min={0}
                max={1000}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.scopeHours)}
                aria-describedby={errors.scopeHours ? "retainer-hours-error" : undefined}
                {...form.register("scopeHours", { valueAsNumber: true })}
              />
              {errors.scopeHours?.message && (
                <p id="retainer-hours-error" role="alert" className="text-sm text-destructive">
                  {errors.scopeHours.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="retainer-start">Start date</Label>
              <Input
                id="retainer-start"
                type="date"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.startDate)}
                aria-describedby={errors.startDate ? "retainer-start-error" : undefined}
                {...form.register("startDate")}
              />
              {errors.startDate?.message && (
                <p id="retainer-start-error" role="alert" className="text-sm text-destructive">
                  {errors.startDate.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="retainer-end">End date</Label>
              <Input
                id="retainer-end"
                type="date"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.endDate)}
                aria-describedby={errors.endDate ? "retainer-end-error" : undefined}
                {...form.register("endDate")}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for an open-ended retainer.
              </p>
              {errors.endDate?.message && (
                <p id="retainer-end-error" role="alert" className="text-sm text-destructive">
                  {errors.endDate.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  {isEditing ? "Saving…" : "Creating…"}
                </>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Create retainer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
