import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/ui/Card';

export function AdminOverview() {
  const { family } = useAuth();
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalTasks: 0,
    pendingApprovals: 0,
    totalRewards: 0,
    activeSeason: '',
  });

  useEffect(() => {
    if (!family) return;

    async function load() {
      const { count: totalMembers } = await supabase
        .from('family_members')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family!.id);

      const { count: activeMembers } = await supabase
        .from('family_members')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family!.id)
        .eq('active', true);

      const { count: totalTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family!.id);

      const { count: pendingApprovals } = await supabase
        .from('task_completions')
        .select('*, tasks!inner(family_id)', { count: 'exact', head: true })
        .eq('tasks.family_id', family!.id)
        .eq('approved', false);

      const { count: totalRewards } = await supabase
        .from('rewards')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family!.id);

      const { data: season } = await supabase
        .from('seasons')
        .select('name')
        .eq('family_id', family!.id)
        .eq('active', true)
        .single();

      setStats({
        totalMembers: totalMembers ?? 0,
        activeMembers: activeMembers ?? 0,
        totalTasks: totalTasks ?? 0,
        pendingApprovals: pendingApprovals ?? 0,
        totalRewards: totalRewards ?? 0,
        activeSeason: season?.name ?? 'Keine',
      });
    }

    load();
  }, [family]);

  return (
    <div>
      <h2>Familien-Übersicht</h2>
      <div className="stat-grid">
        <StatCard label="Mitglieder" value={`${stats.activeMembers}/${stats.totalMembers}`} icon="👥" />
        <StatCard label="Aufgaben" value={stats.totalTasks} icon="📋" />
        <StatCard label="Wartend" value={stats.pendingApprovals} icon="⏳" hint="Bestätigungen" />
        <StatCard label="Belohnungen" value={stats.totalRewards} icon="🎁" />
        <StatCard label="Aktive Saison" value={stats.activeSeason} icon="📅" />
      </div>
    </div>
  );
}
