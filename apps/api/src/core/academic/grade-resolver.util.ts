/**
 * Authoritative Centralized Grade Resolution Utility (Change #8F Step 13).
 * Eliminates scattered/magic conversions (e.g. numericLevel - 2, ad-hoc regex).
 * Standard K-12 schooling operates strictly between grades 1 and 12.
 */
export function resolveGradeLevel(source?: {
  numericLevel?: number | null;
  name?: string | null;
} | null): number {
  if (!source) return 1;

  // 1. Direct authoritative numericLevel (source of truth)
  if (
    typeof source.numericLevel === 'number' &&
    !isNaN(source.numericLevel) &&
    source.numericLevel >= 1 &&
    source.numericLevel <= 12
  ) {
    return source.numericLevel;
  }

  // 2. Parse standard class/grade name if available (e.g. "Class 10", "Grade 5", "10-A")
  if (source.name && typeof source.name === 'string') {
    const match = source.name.match(/\b([1-9]|1[0-2])\b/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (parsed >= 1 && parsed <= 12) {
        return parsed;
      }
    }
  }

  // 3. Fail-safe standard default
  return 1;
}
