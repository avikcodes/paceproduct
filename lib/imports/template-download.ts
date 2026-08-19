"use client";

import { buildTemplateCsv } from "@/lib/imports/templates";
import type { ImportTemplate } from "@/lib/imports/templates";

export function downloadTemplateCsv(template: ImportTemplate): void {
  const csv = buildTemplateCsv(template);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = template.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
