import type { MenuDay } from '@/app/types';

// Objednávku na daný den (YYYY-MM-DD) lze přijmout jen do 10:00 předchozího dne.
export function isDateOrderable(date: string, now: Date = new Date()): boolean {
  const deadline = new Date(date + 'T10:00:00');
  deadline.setDate(deadline.getDate() - 1);
  return now < deadline;
}

export function getOrderableDays(days: MenuDay[], now: Date = new Date()): MenuDay[] {
  return days.filter((d) => isDateOrderable(d.date, now));
}
