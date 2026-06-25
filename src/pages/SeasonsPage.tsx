import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { useToast } from '../components/ui/Toast';
import { PERMISSIONS } from '../lib/permissions';

import type { Season } from '../lib/types';

export function SeasonsPage() {
  const { family, hasPermission } = useAuth();
  const { toast } = useToast();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const canManage = hasPermission(PERMISSIONS.MANAGE_SEASONS);

  useEffect(() => {
    if (!family) return;
    loadSeasons();
  }, [family]);

  async function loadSeasons() {
    if (!family) return;
    setLoading(true);
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('family_id', family.id)
      .order('start_date', { ascending: false });
    setSeasons(data ?? []);
    setLoading(false);
  }

  async function startNewSeason() {
    if (!family) return;
    setWorking(true);

    const { data: rules } = await supabase
      .from('family_rules')
      .select('season_length_months')
      .eq('family_id', family.id)
      .single();

    const activeSeason = seasons.find((s) => s.active);
    if (activeSeason) {
      await supabase
        .from('seasons')
        .update({ active: false, archived: true })
        .eq('id', activeSeason.id);
    }

    await supabase
      .from('family_members')
      .update({ season_victory_points: 0 })
      .eq('family_id', family.id);

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + (rules?.season_length_months ?? 2));

    const seasonNumber = seasons.length + 1;

    await supabase.from('seasons').insert({
      family_id: family.id,
      name: `Saison ${seasonNumber}`,
      start_date: now.toISOString(),
      end_date: endDate.toISOString(),
      active: true,
    });

    toast('Neue Saison gestartet!');
    setWorking(false);
    loadSeasons();
  }

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

  if (loading) return <div className="page"><p className="muted">Lädt...</p></div>;

  const activeSeason = seasons.find((s) => s.active);
  const archived = seasons.filter((s) => !s.active);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Saisons</h1>
        <p className="muted">Jede Saison ist ein neuer Wettkampf um Siegpunkte. Gesamtsiegpunkte bleiben dauerhaft erhalten.</p>
      </div>

      {activeSeason && (
        <section className="section">
          <h2>Aktuelle Saison</h2>
          <div className="card card-pad-md season-active">
            <div className="season-active-head">
              <strong>{activeSeason.name}</strong>
              <Pill tone="good">Aktiv</Pill>
            </div>
            <p className="muted small">{fmt(activeSeason.start_date)} – {fmt(activeSeason.end_date)}</p>
          </div>
        </section>
      )}

      {canManage && (
        <section className="section">
          <div className="admin-section-header">
            <h2>Verwaltung</h2>
            <Button size="sm" onClick={startNewSeason} loading={working}>
              Neue Saison starten
            </Button>
          </div>
          <p className="muted small">
            Beim Start einer neuen Saison wird die aktuelle archiviert, die Saison-Siegpunkte werden zurückgesetzt
            und eine neue Saison beginnt. Die Saisonlänge legst du im Admin-Bereich unter „Regeln" fest.
          </p>
        </section>
      )}

      <section className="section">
        <h2>Archiv</h2>
        {archived.length === 0 && <p className="muted">Noch keine archivierten Saisons.</p>}
        <div className="admin-list">
          {archived.map((season) => (
            <div key={season.id} className="card card-pad-sm admin-item">
              <div className="admin-item-header">
                <div>
                  <strong>{season.name}</strong>
                  <span className="muted small"> · {fmt(season.start_date)} – {fmt(season.end_date)}</span>
                </div>
                <Pill tone="neutral">Archiviert</Pill>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
