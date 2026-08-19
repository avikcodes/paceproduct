import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

export function Logo({ className, withWordmark = true, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm shadow-blue-900/20 ring-1 ring-blue-900/10">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="size-3.5 text-white"
        >
          <path
            d="M4 16.5 8.2 11l3.1 3.4 3.2-4.9 5.5 7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="18.8" cy="7.5" r="1.6" fill="currentColor" />
        </svg>
      </span>
      {withWordmark && (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-tight text-foreground",
            wordmarkClassName
          )}
        >
          Pace
        </span>
      )}
    </span>
  );
}
