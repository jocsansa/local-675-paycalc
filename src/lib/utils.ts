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
