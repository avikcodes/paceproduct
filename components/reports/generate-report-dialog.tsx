"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { generateReport } from "@/app/(app)/dashboard/reports/actions";
import { reportMonthLabelFromKey } from "@/lib/format";
import type { ReportRow } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClientOption = { id: string; name: string };

const reportFormSchema = z.object({
  clientId: z.string().min(1, "Choose a client."),
  monthKey: z.string().min(1, "Choose a report month."),
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

type GenerateReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientOption[];
  months: string[];
  onCreated: (report: ReportRow) => void;
};

export function GenerateReportDialog({
  open,
  onOpenChange,
  clients,
  months,
  onCreated,
}: GenerateReportDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { clientId: "", monthKey: "" },
  });

  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset({ clientId: "", monthKey: "" });
    }
  }, [open, form]);

  async function onSubmit(values: ReportFormValues) {
    setIsSubmitting(true);

    const result = await generateReport(values.clientId, values.monthKey);

    if (result.ok) {
      onCreated(result.data);
      toast.success("Report generated.");
      onOpenChange(false);
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
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Generate report</DialogTitle>
            <DialogDescription>
              Snapshot revenue, cost, and profit for a client and month.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="report-client">
              Client <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  items={Object.fromEntries(
                    clients.map((client) => [client.id, client.name]),
                  )}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label="Client"
                    aria-invalid={Boolean(errors.clientId)}
                    aria-describedby={
                      errors.clientId ? "report-client-error" : undefined
                    }
                  >
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.clientId?.message && (
              <p
                id="report-client-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.clientId.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="report-month">
              Report month <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={form.control}
              name="monthKey"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  items={Object.fromEntries(
                    months.map((key) => [
                      key,
                      reportMonthLabelFromKey(key),
                    ]),
                  )}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label="Report month"
                    aria-invalid={Boolean(errors.monthKey)}
                    aria-describedby={
                      errors.monthKey ? "report-month-error" : undefined
                    }
                  >
                    <SelectValue placeholder="Select a month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((key) => (
                      <SelectItem key={key} value={key}>
                        {reportMonthLabelFromKey(key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.monthKey?.message && (
              <p
                id="report-month-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.monthKey.message}
              </p>
            )}
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
                  Generating…
                </>
              ) : (
                <>
                  <Plus />
                  Generate Report
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
