"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadTemplateCsv } from "@/lib/imports/template-download";
import type { ImportTemplate } from "@/lib/imports/templates";

type TemplateDownloadButtonProps = {
  template: ImportTemplate;
  label?: string;
  className?: string;
};

export function TemplateDownloadButton({
  template,
  label = "Download Template",
  className,
}: TemplateDownloadButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={() => downloadTemplateCsv(template)}
    >
      <Download />
      {label}
    </Button>
  );
}
