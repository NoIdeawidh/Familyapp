import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { useToast } from '../components/ui/Toast';
import { PERMISSIONS } from '../lib/permissions';

import type { Season, SeasonResult } from '../lib/types';

interface SeasonReward {
  id: string;
  redeemed_at: string;
  reward_name: string;
  cost_in_gold: number;
  member_name: string;
}

export function SeasonsPage() {
  const { family, hasPermission } = useAuth();
  const { toast } = useToast();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [openSeason, setOpenSeason] = useState<Season | null>(null);
  const [results, setResults] = useState<SeasonResult[]>([]);
  const [rewards, setRewards] = useState<SeasonReward[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const canManage = hasPermission(PERMISSIONS.MANAGE_SEASONS);

  useEffect(() => {
    if (!family) return;
    loadSeasons();
  }, [family]);

  async function loadSeasons() {
    if (!family) return;
    setLoading(true);
    // Automatically archive a season whose end date has passed.
    await supabase.rpc('archive_expired_season', { p_family_id: family.id });
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
    const { error } = await supabase.rpc('start_new_season', { p_family_id: family.id });
    if (error) {
      toast('Saison konnte nicht gestartet werden.', 'error');
    } else {
      toast('Neue Saison gestartet!');
    }
    setWorking(false);
    loadSeasons();
  }

  async function openArchive(season: Season) {
    if (openSeason?.id === season.id) {
      setOpenSeason(null);
      return;
    }
    setOpenSeason(season);
    setDetailLoading(true);

    const { data: resultData } = await supabase
      .from('season_results')
      .select('*')
      .eq('season_id', season.id)
      .order('rank', { ascending: true });

    const { data: redemptionData } = await supabase
      .from('reward_redemptions')
      .select('id, redeemed_at, rewards(name, cost_in_gold), family_members(name)')
      .gte('redeemed_at', season.start_date)
      .lte('redeemed_at', season.end_date)
      .order('redeemed_at', { ascending: false });

    setResults(resultData ?? []);
    setRewards(
      (redemptionData ?? []).map((r) => {
        const reward = r.rewards as unknown as { name: string; cost_in_gold: number } | null;
        const mem = r.family_members as unknown as { name: string } | null;
        return {
          id: r.id,
          redeemed_at: r.redeemed_at,
          reward_name: reward?.name ?? 'Belohnung',
          cost_in_gold: reward?.cost_in_gold ?? 0,
          member_name: mem?.name ?? 'Unbekannt',
        };
      })
    );
    setDetailLoading(false);
  }

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

  if (loading) return <div className="page"><p className="muted">Lädt...</p></div>;

  const activeSeason = seasons.find((s) => s.active);
  const archived = seasons.filter((s) => !s.active);

  const daysLeft = activeSeason
    ? Math.ceil((new Date(activeSeason.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

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
            <p className="muted small">
              {daysLeft > 0
                ? `Endet automatisch in ${daysLeft} Tag${daysLeft === 1 ? '' : 'en'}.`
                : 'Laufzeit abgelaufen – wird beim nächsten Laden archiviert.'}
            </p>
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
            Beim Start einer neuen Saison wird die aktuelle archiviert (Ergebnisse bleiben erhalten), die
            Saison-Siegpunkte werden zurückgesetzt und eine neue Saison beginnt. Die Saisonlänge (Standard 4 Wochen)
            legst du im Admin-Bereich unter „Regeln" fest; nach Ablauf endet die Saison automatisch.
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
                <div className="admin-item-actions">
                  <Pill tone="neutral">Archiviert</Pill>
                  <Button size="sm" variant="ghost" onClick={() => openArchive(season)}>
                    {openSeason?.id === season.id ? 'Schließen' : 'Ansehen'}
                  </Button>
                </div>
              </div>

              {openSeason?.id === season.id && (
                <div className="season-detail">
                  {detailLoading ? (
                    <p className="muted small">Lädt Statistiken…</p>
                  ) : (
                    <>
                      <h3>Endstand</h3>
                      {results.length === 0 ? (
                        <p className="muted small">Keine Platzierungen erfasst.</p>
                      ) : (
                        <table className="season-table">
                          <thead>
                            <tr><th>#</th><th>Spieler</th><th>Siegpunkte</th><th>Aufgaben</th><th>Untertanen</th></tr>
                          </thead>
                          <tbody>
                            {results.map((r) => (
                              <tr key={r.id}>
                                <td>{r.rank}</td>
                                <td>{r.member_avatar} {r.member_name}</td>
                                <td>{r.victory_points}</td>
                                <td>{r.tasks_completed}</td>
                                <td>{r.underlings_earned}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <h3>Belohnungen in dieser Saison</h3>
                      {rewards.length === 0 ? (
                        <p className="muted small">Keine Belohnungen eingelöst.</p>
                      ) : (
                        <ul className="season-rewards">
                          {rewards.map((r) => (
                            <li key={r.id}>
                              {r.member_name} · {r.reward_name} <span className="muted small">({r.cost_in_gold} Gold · {fmt(r.redeemed_at)})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
