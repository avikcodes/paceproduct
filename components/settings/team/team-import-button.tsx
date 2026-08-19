"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecImportDialog } from "@/components/import/spec-import-dialog";
import { TEAM_IMPORT_SPEC } from "@/lib/imports/team";
import type { ImportRefs } from "@/lib/imports/types";

export function TeamImportButton({ refs }: { refs: ImportRefs }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload />
        Import CSV
      </Button>
      <SpecImportDialog
        key={open ? "open" : "closed"}
        open={open}
        onOpenChange={setOpen}
        spec={TEAM_IMPORT_SPEC}
        endpoint="/api/team/import"
        refs={refs}
        onComplete={() => router.refresh()}
      />
    </>
  );
}
