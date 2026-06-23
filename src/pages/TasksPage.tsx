import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { useToast } from '../components/ui/Toast';
import { PERMISSIONS } from '../lib/permissions';


import type { Task, TaskCompletion, FamilyMember } from '../lib/types';

export function TasksPage() {
  const { member, family, hasPermission } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function handleComplete(taskId: string) {
    if (!member || !family) return;

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

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    await supabase.from('task_completions').insert({
      task_id: taskId,
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

  if (loading) return <div className="page"><p className="muted">Lädt...</p></div>;
  if (!member) return null;

  const visibleTasks = tasks.filter((task) => {
    if (task.type === 'open') return true;
    if (task.assigned_to === member.id) return true;
    if (hasPermission(PERMISSIONS.APPROVE_TASKS)) return true;
    return false;
  });

  const privateTasks = visibleTasks.filter((t) => t.type === 'private');
  const openTasks = visibleTasks.filter((t) => t.type === 'open');
  const pendingCompletions = completions.filter((c) => !c.approved);
  const canApprove = hasPermission(PERMISSIONS.APPROVE_TASKS);

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? 'Unbekannt';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Aufgaben</h1>
        <p className="muted">Erledige Aufgaben, um Untertanen zu verdienen.</p>
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
                    <Button size="sm" onClick={() => handleApprove(completion.id)}>
                      Bestätigen
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
                onComplete={() => handleComplete(task.id)}
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
                onComplete={() => handleComplete(task.id)}
              />
            ))}
          </div>
        </section>
      </div>
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
  const myCompletion = completions.find((c) => c.member_id === memberId);
  const isPending = myCompletion && !myCompletion.approved;
  const isDone = myCompletion?.approved;
  const canDo = !isPending && !isDone && (task.type === 'open' || task.assigned_to === memberId);

  return (
    <div className="card card-pad-md task-card">
      <div className="task-header">
        <strong>{task.title}</strong>
        <Pill tone={isPending ? 'warn' : isDone ? 'good' : 'neutral'}>
          {isPending ? 'wartend' : isDone ? 'erledigt' : 'offen'}
        </Pill>
      </div>
      {task.description && <p className="task-desc">{task.description}</p>}
      <div className="task-meta">
        <span>{task.value_in_underlings} Untertanen</span>
        <span>{task.category}</span>
        {task.needs_approval && <span>Bestätigung nötig</span>}
      </div>
      <div className="task-actions">
        <Button size="sm" onClick={onComplete} disabled={!canDo}>
          {isPending ? 'Wartend...' : isDone ? 'Erledigt' : 'Abhaken'}
        </Button>
      </div>
    </div>
  );
}
