export function clockValueAfterClick(selectedValue, currentValue, maximum) {
  const selected = Number(selectedValue);
  const current = Number(currentValue);
  const max = Number(maximum);
  if (![selected, current, max].every(Number.isInteger) || max < 1) return null;

  const clamped = Math.min(max, Math.max(1, selected));
  return clamped <= current ? clamped - 1 : clamped;
}
