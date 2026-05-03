import type { MenuDay } from '@/app/types';

export function getOrderableDays(days: MenuDay[], now: Date = new Date()): MenuDay[] {
  return days.filter((d) => {
    const deadline = new Date(d.date + 'T10:00:00');
    deadline.setDate(deadline.getDate() - 1);
    return now < deadline;
  });
}
