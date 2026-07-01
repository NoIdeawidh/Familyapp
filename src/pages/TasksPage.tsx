import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Pill } from '../components/ui/Pill';
import { useToast } from '../components/ui/Toast';
import { PERMISSIONS, isPlayingMember } from '../lib/permissions';
import { recurrenceLabel, taskStateForMember, isOverdue } from '../lib/tasks';

import type { Task, TaskCompletion, FamilyMember, Recurrence } from '../lib/types';

interface TaskInput {
  title: string;
  description: string;
  type: 'private' | 'open';
  assigned_to: string | null;
  value_in_underlings: number;
  needs_approval: boolean;
  recurrence: Recurrence;
  recurrence_interval_days: number | null;
  due_date: string | null;
  repeatable: boolean;
  category: string;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

export function TasksPage() {
  const { member, family, hasPermission } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canCreate = hasPermission(PERMISSIONS.CREATE_TASKS);
  const canEdit = hasPermission(PERMISSIONS.EDIT_TASKS);
  const canDelete = hasPermission(PERMISSIONS.DELETE_TASKS);
  const canApprove = hasPermission(PERMISSIONS.APPROVE_TASKS);
  const canManage = canCreate || canDelete || canEdit;
  const isPlaying = !!member && isPlayingMember(member.role) && hasPermission(PERMISSIONS.COMPLETE_OWN_TASKS);

  useEffect(() => {
    if (!family) return;
    loadTasks();
  }, [family]);

  async function loadTasks() {
    if (!family) return;
    setLoading(true);

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false });

    const { data: completionsData } = await supabase
      .from('task_completions')
      .select('*')
      .in('task_id', (tasksData ?? []).map((t) => t.id));

    const { data: membersData } = await supabase
      .from('family_members')
      .select('*')
      .eq('family_id', family.id)
      .eq('active', true);

    setTasks(tasksData ?? []);
    setCompletions(completionsData ?? []);
    setMembers(membersData ?? []);
    setLoading(false);
  }

  async function handleComplete(task: Task) {
    if (!member || !family) return;
    if (isOverdue(task)) {
      toast('Frist abgelaufen – Aufgabe kann nicht mehr erledigt werden.', 'error');
      return;
    }

    const { data: season } = await supabase
      .from('seasons')
      .select('id')
      .eq('family_id', family.id)
      .eq('active', true)
      .single();

    if (!season) {
      toast('Keine aktive Saison gefunden.', 'error');
      return;
    }

    await supabase.from('task_completions').insert({
      task_id: task.id,
      member_id: member.id,
      season_id: season.id,
      approved: !task.needs_approval,
    });

    if (!task.needs_approval) {
      await supabase
        .from('family_members')
        .update({ underlings: member.underlings + task.value_in_underlings })
        .eq('id', member.id);
    }

    toast(task.needs_approval ? 'Aufgabe eingereicht – wartet auf Bestätigung' : 'Aufgabe erledigt!');
    loadTasks();
  }

  async function handleApprove(completionId: string) {
    if (!member) return;

    const completion = completions.find((c) => c.id === completionId);
    if (!completion) return;
    const task = tasks.find((t) => t.id === completion.task_id);
    if (!task) return;

    await supabase
      .from('task_completions')
      .update({ approved: true, approved_by: member.id })
      .eq('id', completionId);

    const targetMember = members.find((m) => m.id === completion.member_id);
    if (targetMember) {
      await supabase
        .from('family_members')
        .update({ underlings: targetMember.underlings + task.value_in_underlings })
        .eq('id', targetMember.id);
    }

    toast('Aufgabe bestätigt');
    loadTasks();
  }

  async function createTask(data: TaskInput) {
    if (!family || !member) return;
    await supabase.from('tasks').insert({ family_id: family.id, created_by: member.id, ...data });
    toast('Aufgabe erstellt');
    setShowCreate(false);
    loadTasks();
  }

  async function updateTask(id: string, data: TaskInput) {
    await supabase.from('tasks').update(data).eq('id', id);
    toast('Aufgabe aktualisiert');
    setEditingId(null);
    loadTasks();
  }

  async function deleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId);
    toast('Aufgabe gelöscht');
    loadTasks();
  }

  if (loading) return <div className="page"><p className="muted">Lädt...</p></div>;
  if (!member) return null;

  const visibleTasks = tasks.filter((task) => {
    if (task.type === 'open') return true;
    if (task.assigned_to === member.id) return true;
    if (canApprove) return true;
    return false;
  });
  const privateTasks = visibleTasks.filter((t) => t.type === 'private');
  const openTasks = visibleTasks.filter((t) => t.type === 'open');
  const pendingCompletions = completions.filter((c) => !c.approved);

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? 'Unbekannt';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Aufgaben</h1>
        <p className="muted">
          {isPlaying ? 'Erledige Aufgaben, um Untertanen zu verdienen.' : 'Verwalte die Aufgaben deiner Familie.'}
        </p>
      </div>

      {canApprove && pendingCompletions.length > 0 && (
        <section className="section">
          <h2>Wartende Bestätigungen ({pendingCompletions.length})</h2>
          <div className="task-list">
            {pendingCompletions.map((completion) => {
              const task = tasks.find((t) => t.id === completion.task_id);
              return (
                <div key={completion.id} className="card card-pad-md task-card">
                  <div className="task-header">
                    <strong>{task?.title ?? 'Aufgabe'}</strong>
                    <Pill tone="warn">wartend</Pill>
                  </div>
                  <p className="muted small">
                    Von {memberName(completion.member_id)} · {task?.value_in_underlings ?? 0} Untertanen
                  </p>
                  <div className="task-actions">
                    <Button size="sm" onClick={() => handleApprove(completion.id)}>Bestätigen</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isPlaying && (
        <div className="tasks-columns">
          <section className="section">
            <h2>Private Aufgaben</h2>
            {privateTasks.length === 0 && <p className="muted">Keine privaten Aufgaben.</p>}
            <div className="task-list">
              {privateTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  memberId={member.id}
                  completions={completions.filter((c) => c.task_id === task.id)}
                  onComplete={() => handleComplete(task)}
                />
              ))}
            </div>
          </section>

          <section className="section">
            <h2>Offene Aufgaben</h2>
            {openTasks.length === 0 && <p className="muted">Keine offenen Aufgaben.</p>}
            <div className="task-list">
              {openTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  memberId={member.id}
                  completions={completions.filter((c) => c.task_id === task.id)}
                  onComplete={() => handleComplete(task)}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {canManage && (
        <section className="section">
          <div className="admin-section-header">
            <h2>Verwaltung</h2>
            {canCreate && (
              <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}>
                {showCreate ? 'Abbrechen' : 'Neue Aufgabe'}
              </Button>
            )}
          </div>

          {showCreate && canCreate && (
            <TaskForm members={members} onSubmit={createTask} submitLabel="Aufgabe erstellen" />
          )}

          <div className="admin-list">
            {tasks.map((task) => (
              <div key={task.id} className="card card-pad-sm admin-item">
                <div className="admin-item-header">
                  <div>
                    <strong>{task.title}</strong>
                    <span className="muted small">
                      {' '}· {task.category} · {task.value_in_underlings} Untertanen · {recurrenceLabel(task)}
                      {task.due_date ? ` · Frist ${new Date(task.due_date).toLocaleDateString('de-DE')}` : ''}
                      {task.type === 'private' && task.assigned_to ? ` · ${memberName(task.assigned_to)}` : ''}
                    </span>
                  </div>
                  <div className="admin-item-actions">
                    <span className={`badge badge-${task.type === 'private' ? 'warn' : 'neutral'}`}>
                      {task.type === 'private' ? 'privat' : 'offen'}
                    </span>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(editingId === task.id ? null : task.id); setShowCreate(false); }}>
                        {editingId === task.id ? 'Schließen' : 'Bearbeiten'}
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="danger" onClick={() => deleteTask(task.id)}>Löschen</Button>
                    )}
                  </div>
                </div>
                {editingId === task.id && canEdit && (
                  <TaskForm
                    members={members}
                    initial={task}
                    submitLabel="Änderungen speichern"
                    onSubmit={(data) => updateTask(task.id, data)}
                  />
                )}
              </div>
            ))}
            {tasks.length === 0 && <p className="muted">Noch keine Aufgaben erstellt.</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskItem({
  task,
  memberId,
  completions,
  onComplete,
}: {
  task: Task;
  memberId: string;
  completions: TaskCompletion[];
  onComplete: () => void;
}) {
  const state = taskStateForMember(task, completions, memberId);
  const canDo = state === 'available' && (task.type === 'open' || task.assigned_to === memberId);

  const pill =
    state === 'pending' ? <Pill tone="warn">wartend</Pill>
    : state === 'done' ? <Pill tone="good">erledigt</Pill>
    : state === 'overdue' ? <Pill tone="danger">abgelaufen</Pill>
    : <Pill tone="neutral">offen</Pill>;

  const buttonLabel =
    state === 'pending' ? 'Wartend...'
    : state === 'done' ? 'Erledigt'
    : state === 'overdue' ? 'Frist abgelaufen'
    : 'Abhaken';

  return (
    <div className="card card-pad-md task-card">
      <div className="task-header">
        <strong>{task.title}</strong>
        {pill}
      </div>
      {task.description && <p className="task-desc">{task.description}</p>}
      <div className="task-meta">
        <span>{task.value_in_underlings} Untertanen</span>
        <span>{task.category}</span>
        <span>{recurrenceLabel(task)}</span>
        {task.due_date && <span>Frist: {new Date(task.due_date).toLocaleDateString('de-DE')}</span>}
        {task.needs_approval && <span>Bestätigung nötig</span>}
      </div>
      <div className="task-actions">
        <Button size="sm" onClick={onComplete} disabled={!canDo}>
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

function TaskForm({
  members,
  onSubmit,
  initial,
  submitLabel,
}: {
  members: FamilyMember[];
  onSubmit: (data: TaskInput) => void;
  initial?: Task;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<'private' | 'open'>(initial?.type ?? 'open');
  const [assignedTo, setAssignedTo] = useState(initial?.assigned_to ?? '');
  const [value, setValue] = useState(initial?.value_in_underlings ?? 1);
  const [needsApproval, setNeedsApproval] = useState(initial?.needs_approval ?? false);
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? 'none');
  const [intervalDays, setIntervalDays] = useState(initial?.recurrence_interval_days ?? 7);
  const [dueDate, setDueDate] = useState(toLocalInput(initial?.due_date ?? null));
  const [category, setCategory] = useState(initial?.category ?? 'Allgemein');

  // Only members who actually play can be assigned a private task.
  const assignable = members.filter((m) => isPlayingMember(m.role));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      type,
      assigned_to: type === 'private' ? assignedTo || null : null,
      value_in_underlings: value,
      needs_approval: needsApproval,
      recurrence,
      recurrence_interval_days: recurrence === 'custom' ? Math.max(1, intervalDays) : null,
      due_date: fromLocalInput(dueDate),
      repeatable: recurrence !== 'none',
      category: category.trim() || 'Allgemein',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card card-pad-md admin-form">
      <div className="form-grid-2">
        <Input label="Titel" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input label="Kategorie" value={category} onChange={(e) => setCategory(e.target.value)} />
        <div className="form-field">
          <label className="form-label">Typ</label>
          <select className="form-input" value={type} onChange={(e) => setType(e.target.value as 'private' | 'open')}>
            <option value="open">Offen (für alle)</option>
            <option value="private">Privat (zugewiesen)</option>
          </select>
        </div>
        {type === 'private' && (
          <div className="form-field">
            <label className="form-label">Zugewiesen an</label>
            <select className="form-input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Bitte wählen…</option>
              {assignable.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <Input label="Wert (Untertanen)" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} min={1} />
        <div className="form-field">
          <label className="form-label">Wiederholung</label>
          <select className="form-input" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            <option value="none">Einmalig</option>
            <option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option>
            <option value="monthly">Monatlich</option>
            <option value="custom">Benutzerdefiniert</option>
          </select>
        </div>
        {recurrence === 'custom' && (
          <Input
            label="Intervall (Tage)"
            type="number"
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
            min={1}
          />
        )}
        <div className="form-field">
          <label className="form-label">Frist (optional)</label>
          <input
            className="form-input"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label className="form-label">Optionen</label>
          <div className="checkbox-group">
            <label><input type="checkbox" checked={needsApproval} onChange={(e) => setNeedsApproval(e.target.checked)} /> Bestätigung nötig</label>
          </div>
        </div>
      </div>
      <Textarea label="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      <Button type="submit" size="sm">{submitLabel}</Button>
    </form>
  );
}
