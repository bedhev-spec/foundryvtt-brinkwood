export const GLOBAL_CLOCK_SIZES = Object.freeze([2, 3, 4, 5, 6, 8, 10, 12]);
export const GLOBAL_CLOCK_MAX_SIZE = 12;

export function clampGlobalClockValue(value, maximum) {
  const max = Math.max(1, Math.min(GLOBAL_CLOCK_MAX_SIZE, Number(maximum) || 4));
  return Math.max(0, Math.min(max, Number(value) || 0));
}

export function normalizeGlobalClock(data = {}) {
  const max = Math.max(1, Math.min(GLOBAL_CLOCK_MAX_SIZE, Number(data.max) || 4));
  return {
    id: data.id ?? null,
    name: String(data.name ?? "").trim(),
    value: clampGlobalClockValue(data.value, max),
    max,
    color: String(data.color || "#8f2f35"),
    backgroundColor: String(data.backgroundColor || "rgba(20, 16, 18, 0.78)"),
    private: Boolean(data.private),
  };
}

export function nextGlobalClockValue(value, maximum) {
  const max = Math.max(1, Number(maximum) || 1);
  const current = clampGlobalClockValue(value, max);
  return current >= max ? 0 : current + 1;
}

export function previousGlobalClockValue(value, maximum) {
  const max = Math.max(1, Number(maximum) || 1);
  const current = clampGlobalClockValue(value, max);
  return current <= 0 ? max : current - 1;
}
