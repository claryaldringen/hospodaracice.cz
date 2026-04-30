export const WEEKS_BACK = 4;
export const WEEKS_FORWARD = 4;

export function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function formatWeekKey(monday: Date): string {
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseWeekKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidWeekKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = parseWeekKey(key);
  if (isNaN(date.getTime())) return false;
  return date.getDay() === 1;
}

export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

export interface WeekOption {
  key: string;
  label: string;
}

export function getWeekOptions(now: Date = new Date()): WeekOption[] {
  const currentMonday = getMonday(now);
  const options: WeekOption[] = [];
  for (let offset = -WEEKS_BACK; offset <= WEEKS_FORWARD; offset++) {
    const monday = new Date(currentMonday);
    monday.setDate(monday.getDate() + offset * 7);
    options.push({
      key: formatWeekKey(monday),
      label: formatWeekRange(monday),
    });
  }
  return options;
}

export function getCurrentWeekKey(now: Date = new Date()): string {
  return formatWeekKey(getMonday(now));
}
