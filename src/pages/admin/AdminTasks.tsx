import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';


import type { Task, FamilyMember } from '../../lib/types';

type Member = FamilyMember;

export function AdminTasks() {
  const { family, member } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!family) return;
    loadTasks();
  }, [family]);

  async function loadTasks() {
    if (!family) return;

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false });

    const { data: membersData } = await supabase
      .from('family_members')
      .select('*')
      .eq('family_id', family.id)
      .eq('active', true);

    setTasks(tasksData ?? []);
    setMembers(membersData ?? []);
  }

  async function createTask(data: {
    title: string;
    description: string;
    type: 'private' | 'open';
    assigned_to: string | null;
    value_in_underlings: number;
    needs_approval: boolean;
    repeatable: boolean;
    category: string;
  }) {
    if (!family || !member) return;

    await supabase.from('tasks').insert({
      family_id: family.id,
      created_by: member.id,
      ...data,
    });

    toast('Aufgabe erstellt');
    setShowCreate(false);
    loadTasks();
  }

  async function deleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId);
    toast('Aufgabe gelöscht');
    loadTasks();
  }

  return (
    <div>
      <div className="admin-section-header">
        <h2>Aufgaben verwalten</h2>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Abbrechen' : 'Neue Aufgabe'}
        </Button>
      </div>

      {showCreate && <TaskForm members={members} onSubmit={createTask} />}

      <div className="admin-list">
        {tasks.map((task) => (
          <div key={task.id} className="card card-pad-sm admin-item">
            <div className="admin-item-header">
              <div>
                <strong>{task.title}</strong>
                <span className="muted small"> · {task.category} · {task.value_in_underlings} Untertanen</span>
              </div>
              <div className="admin-item-actions">
                <span className={`badge badge-${task.type === 'private' ? 'warn' : 'neutral'}`}>
                  {task.type === 'private' ? 'privat' : 'offen'}
                </span>
                <Button size="sm" variant="danger" onClick={() => deleteTask(task.id)}>
                  Löschen
                </Button>
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="muted">Noch keine Aufgaben erstellt.</p>}
      </div>
    </div>
  );
}

function TaskForm({
  members,
  onSubmit,
}: {
  members: Member[];
  onSubmit: (data: {
    title: string;
    description: string;
    type: 'private' | 'open';
    assigned_to: string | null;
    value_in_underlings: number;
    needs_approval: boolean;
    repeatable: boolean;
    category: string;
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'private' | 'open'>('open');
  const [assignedTo, setAssignedTo] = useState('');
  const [value, setValue] = useState(1);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [repeatable, setRepeatable] = useState(true);
  const [category, setCategory] = useState('Allgemein');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      type,
      assigned_to: assignedTo || null,
      value_in_underlings: value,
      needs_approval: needsApproval,
      repeatable,
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
            <option value="open">Offen</option>
            <option value="private">Privat</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Zugewiesen an</label>
          <select className="form-input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Niemand</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <Input label="Wert (Untertanen)" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} min={1} />
        <div className="form-field">
          <label className="form-label">Optionen</label>
          <div className="checkbox-group">
            <label><input type="checkbox" checked={needsApproval} onChange={(e) => setNeedsApproval(e.target.checked)} /> Bestätigung nötig</label>
            <label><input type="checkbox" checked={repeatable} onChange={(e) => setRepeatable(e.target.checked)} /> Wiederholbar</label>
          </div>
        </div>
      </div>
      <Textarea label="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      <Button type="submit" size="sm">Aufgabe erstellen</Button>
    </form>
  );
}
