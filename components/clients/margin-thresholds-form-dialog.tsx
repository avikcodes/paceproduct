"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateMarginThresholds } from "@/app/(app)/dashboard/clients/[clientId]/actions";
import {
  marginThresholdsFormDefaults,
  marginThresholdsFormSchema,
  type MarginThresholdsFormValues,
} from "@/lib/margin-thresholds";
import type { MarginThresholds } from "@/lib/margin-status";
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

type MarginThresholdsFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  thresholds: MarginThresholds;
  onSaved?: () => void;
};

type ThresholdField = {
  key: keyof MarginThresholdsFormValues;
  label: string;
  description: string;
};

const THRESHOLD_FIELDS: ReadonlyArray<ThresholdField> = [
  {
    key: "healthy",
    label: "Healthy %",
    description: "Margin % at or above which the client is Healthy.",
  },
  {
    key: "warning",
    label: "Warning %",
    description: "Margin % below which the client is no longer Healthy.",
  },
  {
    key: "critical",
    label: "Critical %",
    description: "Margin % below which the client is Critical.",
  },
];

export function MarginThresholdsFormDialog({
  open,
  onOpenChange,
  clientId,
  thresholds,
  onSaved,
}: MarginThresholdsFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MarginThresholdsFormValues>({
    resolver: zodResolver(marginThresholdsFormSchema),
    defaultValues: marginThresholdsFormDefaults(thresholds),
  });

  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset(marginThresholdsFormDefaults(thresholds));
    }
  }, [open, thresholds, form]);

  async function onSubmit(values: MarginThresholdsFormValues) {
    setIsSubmitting(true);

    const result = await updateMarginThresholds(clientId, values);

    if (result.ok) {
      toast.success("Margin thresholds updated.");
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
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Margin thresholds</DialogTitle>
            <DialogDescription>
              Set the status bands used to classify this client&apos;s margin.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {THRESHOLD_FIELDS.map((field) => {
              const error = errors[field.key];
              const inputId = `margin-threshold-${field.key}`;
              return (
                <div key={field.key} className="flex flex-col gap-2">
                  <Label htmlFor={inputId}>{field.label}</Label>
                  <div className="relative">
                    <Input
                      id={inputId}
                      inputMode="decimal"
                      placeholder="0"
                      disabled={isSubmitting}
                      aria-invalid={Boolean(error)}
                      aria-describedby={
                        error ? `${inputId}-error` : undefined
                      }
                      className="pr-8"
                      {...form.register(field.key)}
                    />
                    <span
                      className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground"
                      aria-hidden="true"
                    >
                      %
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {field.description}
                  </p>
                  {error?.message && (
                    <p
                      id={`${inputId}-error`}
                      role="alert"
                      className="text-sm text-destructive"
                    >
                      {error.message}
                    </p>
                  )}
                </div>
              );
            })}
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
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
