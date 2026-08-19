"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createTimeEntry,
  updateTimeEntry,
} from "@/app/(app)/dashboard/time/actions";
import {
  memberLabel,
  timeEntryFormDefaults,
  timeEntryFormFromRow,
  timeEntryFormSchema,
  type ClientOption,
  type MemberOption,
  type TimeEntryFormValues,
  type TimeEntryRow,
} from "@/lib/time";
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

type TimeEntryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: TimeEntryRow | null;
  clients: ClientOption[];
  members: MemberOption[];
  onCreated: (entry: TimeEntryRow) => void;
  onUpdated: (entry: TimeEntryRow) => void;
};

export function TimeEntryFormDialog({
  open,
  onOpenChange,
  entry,
  clients,
  members,
  onCreated,
  onUpdated,
}: TimeEntryFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(entry);

  const form = useForm<TimeEntryFormValues>({
    resolver: zodResolver(timeEntryFormSchema),
    defaultValues: timeEntryFormDefaults(),
  });

  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset(entry ? timeEntryFormFromRow(entry) : timeEntryFormDefaults());
    }
  }, [open, entry, form]);

  async function onSubmit(values: TimeEntryFormValues) {
    setIsSubmitting(true);

    if (isEditing && entry) {
      const result = await updateTimeEntry(entry.id, values);
      if (result.ok) {
        onUpdated(result.data);
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await createTimeEntry(values);
      if (result.ok) {
        onCreated(result.data);
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
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
            <DialogTitle>{isEditing ? "Edit time entry" : "Log time"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the details for this time entry."
                : "Record billable hours for a client."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="time-client">
                Client <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    items={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Client"
                      aria-invalid={Boolean(errors.clientId)}
                      aria-describedby={
                        errors.clientId ? "time-client-error" : undefined
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
                <p id="time-client-error" role="alert" className="text-sm text-destructive">
                  {errors.clientId.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="time-member">
                Team member <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={form.control}
                name="memberId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    items={Object.fromEntries(
                      members.map((m) => [m.id, memberLabel(m)]),
                    )}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Team member"
                      aria-invalid={Boolean(errors.memberId)}
                      aria-describedby={
                        errors.memberId ? "time-member-error" : undefined
                      }
                    >
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {memberLabel(member)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.memberId?.message && (
                <p id="time-member-error" role="alert" className="text-sm text-destructive">
                  {errors.memberId.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="time-task">
                Task <span className="text-destructive">*</span>
              </Label>
              <Input
                id="time-task"
                placeholder="e.g. Website design sprint"
                autoComplete="off"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.task)}
                aria-describedby={errors.task ? "time-task-error" : undefined}
                {...form.register("task")}
              />
              {errors.task?.message && (
                <p id="time-task-error" role="alert" className="text-sm text-destructive">
                  {errors.task.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="time-hours">
                Hours <span className="text-destructive">*</span>
              </Label>
              <Input
                id="time-hours"
                inputMode="decimal"
                placeholder="4.5"
                autoComplete="off"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.hours)}
                aria-describedby={errors.hours ? "time-hours-error" : undefined}
                {...form.register("hours")}
              />
              {errors.hours?.message && (
                <p id="time-hours-error" role="alert" className="text-sm text-destructive">
                  {errors.hours.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="time-work-date">
                Work date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="time-work-date"
                type="date"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.workDate)}
                aria-describedby={errors.workDate ? "time-work-date-error" : undefined}
                {...form.register("workDate")}
              />
              {errors.workDate?.message && (
                <p id="time-work-date-error" role="alert" className="text-sm text-destructive">
                  {errors.workDate.message}
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
                  {isEditing ? "Saving…" : "Logging…"}
                </>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Log time"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
