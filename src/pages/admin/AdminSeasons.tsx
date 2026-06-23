import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { useToast } from '../../components/ui/Toast';


import type { Season } from '../../lib/types';

export function AdminSeasons() {
  const { family } = useAuth();
  const { toast } = useToast();
  const [seasons, setSeasons] = useState<Season[]>([]);

  useEffect(() => {
    if (!family) return;
    loadSeasons();
  }, [family]);

  async function loadSeasons() {
    if (!family) return;
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('family_id', family.id)
      .order('start_date', { ascending: false });
    setSeasons(data ?? []);
  }

  async function startNewSeason() {
    if (!family) return;

    // Archive current season
    const activeSeason = seasons.find((s) => s.active);
    if (activeSeason) {
      await supabase
        .from('seasons')
        .update({ active: false, archived: true })
        .eq('id', activeSeason.id);
    }

    // Reset season VP for all members
    await supabase
      .from('family_members')
      .update({ season_victory_points: 0 })
      .eq('family_id', family.id);

    // Create new season
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 2);

    const seasonNumber = seasons.length + 1;

    await supabase.from('seasons').insert({
      family_id: family.id,
      name: `Saison ${seasonNumber}`,
      start_date: now.toISOString(),
      end_date: endDate.toISOString(),
      active: true,
    });

    toast('Neue Saison gestartet!');
    loadSeasons();
  }

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

  return (
    <div>
      <div className="admin-section-header">
        <h2>Saisons</h2>
        <Button size="sm" onClick={startNewSeason}>
          Neue Saison starten
        </Button>
      </div>

      <div className="admin-list">
        {seasons.map((season) => (
          <div key={season.id} className="card card-pad-sm admin-item">
            <div className="admin-item-header">
              <div>
                <strong>{season.name}</strong>
                <span className="muted small"> · {fmt(season.start_date)} – {fmt(season.end_date)}</span>
              </div>
              <Pill tone={season.active ? 'good' : 'neutral'}>
                {season.active ? 'Aktiv' : 'Archiviert'}
              </Pill>
            </div>
          </div>
        ))}
        {seasons.length === 0 && <p className="muted">Noch keine Saison erstellt.</p>}
      </div>
    </div>
  );
}
