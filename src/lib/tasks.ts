import type { Recurrence, Task, TaskCompletion } from './types';

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Einmalig',
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  custom: 'Benutzerdefiniert',
};

export function recurrenceLabel(task: Task): string {
  if (task.recurrence === 'custom') {
    const n = task.recurrence_interval_days ?? 0;
    return `Alle ${n} Tage`;
  }
  return RECURRENCE_LABELS[task.recurrence];
}

/**
 * Start of the current recurrence window. Completions at or after this instant
 * count against the task for the current period. `none` returns null, meaning a
 * single completion ever blocks the task.
 */
export function windowStart(task: Task, now = new Date()): Date | null {
  switch (task.recurrence) {
    case 'none':
      return null;
    case 'daily': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'weekly': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      // ISO week starts Monday.
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      return d;
    }
    case 'monthly': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return d;
    }
    case 'custom': {
      const days = task.recurrence_interval_days ?? 1;
      const d = new Date(now);
      d.setDate(d.getDate() - Math.max(1, days));
      return d;
    }
  }
}

export function isOverdue(task: Task, now = new Date()): boolean {
  if (!task.due_date) return false;
  return now.getTime() > new Date(task.due_date).getTime();
}

/** The member's completions for this task within the current recurrence window. */
export function completionsInWindow(
  task: Task,
  completions: TaskCompletion[],
  memberId: string,
  now = new Date()
): TaskCompletion[] {
  const start = windowStart(task, now);
  return completions.filter((c) => {
    if (c.member_id !== memberId) return false;
    if (!start) return true;
    return new Date(c.completed_at).getTime() >= start.getTime();
  });
}

export type TaskState = 'done' | 'pending' | 'overdue' | 'available';

export function taskStateForMember(
  task: Task,
  completions: TaskCompletion[],
  memberId: string,
  now = new Date()
): TaskState {
  const inWindow = completionsInWindow(task, completions, memberId, now);
  if (inWindow.some((c) => c.approved)) return 'done';
  if (inWindow.some((c) => !c.approved)) return 'pending';
  if (isOverdue(task, now)) return 'overdue';
  return 'available';
}
