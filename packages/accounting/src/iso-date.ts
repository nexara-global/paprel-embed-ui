/** ISO calendar date string used across embed API boundaries (YYYY-MM-DD). */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Today in the user's local timezone as YYYY-MM-DD (avoids UTC drift from toISOString). */
export function todayIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Normalize API / attribute values to YYYY-MM-DD for form inputs and query params. */
export function normalizeIsoDate(value: string | null | undefined): string {
  if (value == null) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (ISO_DATE_PATTERN.test(trimmed)) return trimmed;
  if (trimmed.length >= 10 && ISO_DATE_PATTERN.test(trimmed.slice(0, 10))) {
    return trimmed.slice(0, 10);
  }
  return trimmed.slice(0, 10);
}
