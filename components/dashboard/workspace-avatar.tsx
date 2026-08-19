import { cn } from "@/lib/utils";

export function WorkspaceAvatar({
  workspaceName,
  size = "default",
  className,
}: {
  workspaceName: string;
  size?: "default" | "sm";
  className?: string;
}) {
  const initial = workspaceName.charAt(0).toUpperCase() || "P";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 font-semibold text-white shadow-sm shadow-blue-900/20",
        size === "sm" ? "size-6 text-xs" : "size-8 text-sm",
        className
      )}
    >
      {initial}
    </div>
  );
}
