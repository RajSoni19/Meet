/** Tiny classname combiner (no dependency). Filters falsy values and joins. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
