"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getClientPdfReport } from "@/app/(app)/dashboard/clients/[clientId]/actions";
import { Button } from "@/components/ui/button";

export function PdfReportButton({ clientId }: { clientId: string }) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await getClientPdfReport(clientId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { downloadClientPdf } = await import("@/lib/pdf-report-generator");
      downloadClientPdf(result.data);
    } catch {
      toast.error("Couldn't generate the PDF report.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleDownload}
      disabled={isGenerating}
      title="Download the monthly PDF report"
      aria-label="Download monthly PDF report"
    >
      {isGenerating ? <Loader2 className="animate-spin" /> : <Download />}
      PDF report
    </Button>
  );
}
