import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Spreadable `value` prop for Radix Select. Passing `value={undefined}` is a type
 * error under exactOptionalPropertyTypes, so an unset selection omits the prop
 * entirely and lets the placeholder show.
 */
export function selectValue(v: string | null | undefined): { value?: string } {
  return v ? { value: v } : {};
}

/**
 * Extracts a human-readable message from a caught value for a toast. Duck-types
 * on `.message` instead of relying solely on `instanceof Error` — a Supabase
 * PostgrestError does extend Error in this build, but errors can cross
 * boundaries (structured clone, a different realm) that break `instanceof`
 * even for a real Error, so checking for the property is more robust than
 * checking the prototype chain. Always logs the raw value so the full object
 * — including a Postgrest error's `code`, `details` and `hint` — is available
 * in devtools even when the toast only has room for the message.
 */
export function getErrorMessage(e: unknown, fallback: string): string {
  console.error(e);
  if (typeof e === "string" && e.trim()) return e;
  if (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string" &&
    (e as { message: string }).message.trim()
  ) {
    const code = "code" in e ? String((e as { code: unknown }).code) : undefined;
    const hint = "hint" in e ? String((e as { hint: unknown }).hint) : undefined;
    const base = (e as { message: string }).message;
    return code && code !== "undefined" ? `${base} (${code})` : hint ? `${base} — ${hint}` : base;
  }
  return fallback;
}
