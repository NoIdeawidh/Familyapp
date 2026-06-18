export function uid(prefix: string, nextIds: Record<string, number>): string {
  const current = nextIds[prefix] ?? 1;
  nextIds[prefix] = current + 1;
  return `${prefix}_${current}`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function sum<T>(items: T[], getter: (item: T) => number): number {
  return items.reduce((acc, item) => acc + getter(item), 0);
}
