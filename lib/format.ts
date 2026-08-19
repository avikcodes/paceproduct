export function getInitials(value: string): string {
  const parts = value.trim().split(/[\s@]+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(date: Date): string {
  const elapsed = date.getTime() - Date.now();
  const absolute = Math.abs(elapsed);

  if (absolute < 60_000) return "just now";

  const units = [
    { ms: 3_600_000, singular: "hour", plural: "hours" },
    { ms: 60_000, singular: "minute", plural: "minutes" },
  ];
  for (const unit of units) {
    if (absolute >= unit.ms) {
      const count = Math.floor(absolute / unit.ms);
      const noun = count === 1 ? unit.singular : unit.plural;
      return elapsed < 0 ? `${count} ${noun} ago` : `in ${count} ${noun}`;
    }
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatActivityTime(date: Date): string {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const time = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  const ms = date.getTime();
  if (ms >= startOfToday) return `Today, ${time}`;
  if (ms >= startOfYesterday) return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatFullDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function monthKeyOf(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function reportMonthLabel(month: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(month);
}

export function reportMonthLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return key;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
