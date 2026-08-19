"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createClient,
  updateClient,
} from "@/app/(app)/dashboard/clients/actions";
import {
  CLIENT_STATUS_OPTIONS,
  clientFormDefaults,
  clientFormFromRow,
  clientFormSchema,
  type ClientFormValues,
  type ClientRow,
} from "@/lib/clients";
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
import { Textarea } from "@/components/ui/textarea";

const STATUS_ITEMS = Object.fromEntries(
  CLIENT_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

type ClientFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientRow | null;
  onCreated: (client: ClientRow) => void;
  onUpdated: (client: ClientRow) => void;
};

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onCreated,
  onUpdated,
}: ClientFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(client);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: clientFormDefaults(),
  });

  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset(client ? clientFormFromRow(client) : clientFormDefaults());
    }
  }, [open, client, form]);

  async function onSubmit(values: ClientFormValues) {
    setIsSubmitting(true);

    if (isEditing && client) {
      const result = await updateClient(client.id, values);
      if (result.ok) {
        onUpdated(result.data);
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await createClient(values);
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
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit client" : "Create client"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the details for this client."
                : "Add a new client to your agency roster."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="client-name">
                Company name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client-name"
                placeholder="Acme Inc."
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "client-name-error" : undefined}
                {...form.register("name")}
              />
              {errors.name?.message && (
                <p id="client-name-error" role="alert" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="client-company">Company</Label>
              <Input
                id="client-company"
                placeholder="Legal or parent company"
                disabled={isSubmitting}
                {...form.register("company")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="client-status">Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    items={STATUS_ITEMS}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-full" aria-label="Status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="client-website">Website</Label>
              <Input
                id="client-website"
                type="url"
                placeholder="https://acme.com"
                autoComplete="off"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.website)}
                aria-describedby={errors.website ? "client-website-error" : undefined}
                {...form.register("website")}
              />
              {errors.website?.message && (
                <p id="client-website-error" role="alert" className="text-sm text-destructive">
                  {errors.website.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="client-contact-name">Primary contact</Label>
              <Input
                id="client-contact-name"
                placeholder="Sarah Johnson"
                autoComplete="off"
                disabled={isSubmitting}
                {...form.register("contactName")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="client-phone">Phone</Label>
              <Input
                id="client-phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                autoComplete="off"
                disabled={isSubmitting}
                {...form.register("phone")}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="client-contact-email">Contact email</Label>
              <Input
                id="client-contact-email"
                type="email"
                placeholder="sarah@acme.com"
                autoComplete="off"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.contactEmail)}
                aria-describedby={errors.contactEmail ? "client-email-error" : undefined}
                {...form.register("contactEmail")}
              />
              {errors.contactEmail?.message && (
                <p id="client-email-error" role="alert" className="text-sm text-destructive">
                  {errors.contactEmail.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="client-notes">Notes</Label>
              <Textarea
                id="client-notes"
                placeholder="Scope, billing details, internal context…"
                disabled={isSubmitting}
                {...form.register("notes")}
              />
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
                "Create client"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
