import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { StatCard } from '../components/ui/Card';
import { isPlayingMember } from '../lib/permissions';

export function DashboardPage() {
  const { member, family } = useAuth();
  const [stats, setStats] = useState({
    openTasks: 0,
    pendingApprovals: 0,
    ownedFields: 0,
    seasonRank: 0,
    activeMembers: 0,
    totalRewards: 0,
  });
  const [season, setSeason] = useState<{ name: string; end_date: string } | null>(null);

  const isPlaying = !!member && isPlayingMember(member.role);

  useEffect(() => {
    if (!member || !family) return;

    async function loadDashboard() {
      const { data: activeSeason } = await supabase
        .from('seasons')
        .select('name, end_date')
        .eq('family_id', family!.id)
        .eq('active', true)
        .single();

      setSeason(activeSeason);

      const { count: openTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family!.id)
        .eq('status', 'open');

      const { count: pendingApprovals } = await supabase
        .from('task_completions')
        .select('*, tasks!inner(family_id)', { count: 'exact', head: true })
        .eq('tasks.family_id', family!.id)
        .eq('approved', false);

      const { count: ownedFields } = await supabase
        .from('fields')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family!.id)
        .eq('owner_id', member!.id);

      const { count: activeMembers } = await supabase
        .from('family_members')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family!.id)
        .eq('active', true)
        .neq('role', 'admin');

      const { count: totalRewards } = await supabase
        .from('rewards')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family!.id);

      // Rank is computed over the competing (non-admin) members only.
      const { data: members } = await supabase
        .from('family_members')
        .select('id, season_victory_points')
        .eq('family_id', family!.id)
        .eq('active', true)
        .neq('role', 'admin')
        .order('season_victory_points', { ascending: false });

      const rank = (members ?? []).findIndex((m) => m.id === member!.id) + 1;

      setStats({
        openTasks: openTasks ?? 0,
        pendingApprovals: pendingApprovals ?? 0,
        ownedFields: ownedFields ?? 0,
        seasonRank: rank || 1,
        activeMembers: activeMembers ?? 0,
        totalRewards: totalRewards ?? 0,
      });
    }

    loadDashboard();
  }, [member, family]);

  if (!member) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{isPlaying ? 'Dashboard' : 'Verwaltungs-Übersicht'}</h1>
        {season && (
          <p className="muted">
            {season.name} · endet am{' '}
            {new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(season.end_date))}
          </p>
        )}
      </div>

      <div className="stat-grid">
        {isPlaying ? (
          <>
            <StatCard label="Untertanen" value={member.underlings} icon="👥" hint="Entstehen durch Aufgaben" />
            <StatCard label="Gold" value={member.gold} icon="💰" hint="Für Belohnungen" />
            <StatCard label="Baumaterial" value={member.building_material} icon="🧱" hint="Für Ausbau" />
            <StatCard label="Siegpunkte" value={member.season_victory_points} icon="⚔️" hint={`Rang ${stats.seasonRank}`} />
            <StatCard label="Offene Aufgaben" value={stats.openTasks} icon="📋" />
            <StatCard label="Eigene Felder" value={stats.ownedFields} icon="🗺️" />
          </>
        ) : (
          <>
            <StatCard label="Aktive Spieler" value={stats.activeMembers} icon="👥" hint="Ohne Admin" />
            <StatCard label="Offene Aufgaben" value={stats.openTasks} icon="📋" />
            <StatCard label="Wartende Bestätigungen" value={stats.pendingApprovals} icon="⏳" />
            <StatCard label="Belohnungen" value={stats.totalRewards} icon="🎁" />
          </>
        )}
      </div>

      {stats.pendingApprovals > 0 && (
        <div className="dashboard-alert">
          <strong>{stats.pendingApprovals} Aufgabe{stats.pendingApprovals > 1 ? 'n' : ''} warten auf Bestätigung</strong>
        </div>
      )}
    </div>
  );
}
