export function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatWeekStart(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseWeekStart(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return getMonday(new Date(y, m - 1, d));
}

export function addWeeks(date, weeks) {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return getMonday(next);
}

export function formatWeekLabel(weekStart) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  const startStr = weekStart.toLocaleDateString(undefined, opts);
  const endStr = end.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}

export function currentWeekStart() {
  return formatWeekStart(getMonday());
}
