import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { useToast } from '../components/ui/Toast';
import { PERMISSIONS, isPlayingMember } from '../lib/permissions';
import { axialToPixel, generateAndInsertMap } from '../lib/hexmap';

import type { Field, FamilyMember } from '../lib/types';

type Member = FamilyMember;

const HEX_SIZE = 34;
const OWNER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777'];

function parsePos(position: string): { q: number; r: number } {
  const [q, r] = position.split(',').map(Number);
  return { q: q || 0, r: r || 0 };
}

export function MapPage() {
  const { member, family, hasPermission } = useAuth();
  const { toast } = useToast();
  const [fields, setFields] = useState<Field[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rules, setRules] = useState({ field_claim_cost: 1, takeover_cost: 2, map_size: 19 });
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const canManageMap = hasPermission(PERMISSIONS.MANAGE_MAP);
  const isAdmin = !!member && !isPlayingMember(member.role);

  useEffect(() => {
    if (!family) return;
    loadMap();
  }, [family]);

  async function loadMap() {
    if (!family) return;
    setLoading(true);

    const { data: season } = await supabase
      .from('seasons')
      .select('id')
      .eq('family_id', family.id)
      .eq('active', true)
      .maybeSingle();

    setSeasonId(season?.id ?? null);
    if (!season) { setFields([]); setLoading(false); return; }

    const { data: fieldsData } = await supabase
      .from('fields')
      .select('*')
      .eq('family_id', family.id)
      .eq('season_id', season.id)
      .order('grid_position');

    const { data: membersData } = await supabase
      .from('family_members')
      .select('*')
      .eq('family_id', family.id)
      .eq('active', true);

    const { data: rulesData } = await supabase
      .from('family_rules')
      .select('field_claim_cost, takeover_cost, map_size')
      .eq('family_id', family.id)
      .maybeSingle();

    setFields(fieldsData ?? []);
    setMembers(membersData ?? []);
    if (rulesData) setRules(rulesData);
    if (fieldsData?.length) setSelectedId((prev) => prev ?? fieldsData[0].id);
    setLoading(false);
  }

  async function handleGenerate(regenerate = false) {
    if (!family || !seasonId) return;
    if (regenerate && !window.confirm('Aktuelle Karte löschen und neu generieren? Aller Feldbesitz geht verloren.')) return;
    setWorking(true);
    try {
      if (regenerate) {
        await supabase.from('fields').delete().eq('season_id', seasonId);
      }
      const n = await generateAndInsertMap(family.id, seasonId, rules.map_size);
      toast(`Karte mit ${n} Feldern erstellt.`);
      setSelectedId(null);
      await loadMap();
    } catch {
      toast('Karte konnte nicht erstellt werden.', 'error');
    }
    setWorking(false);
  }

  function ownedPositions(): Set<string> {
    if (!member) return new Set();
    return new Set(fields.filter((f) => f.owner_id === member.id).map((f) => f.grid_position));
  }

  function canClaim(field: Field): boolean {
    if (!member || isAdmin || !hasPermission(PERMISSIONS.CLAIM_FIELDS)) return false;
    if (field.owner_id === member.id || field.status !== 'free') return false;
    if (member.underlings < rules.field_claim_cost) return false;
    const owned = ownedPositions();
    if (owned.size === 0) return true;
    return field.adjacent_positions.some((p) => owned.has(p));
  }

  function canTakeover(field: Field): boolean {
    if (!member || isAdmin || !hasPermission(PERMISSIONS.CLAIM_FIELDS)) return false;
    if (field.owner_id === member.id || !field.owner_id) return false;
    if (member.underlings < rules.takeover_cost) return false;
    const owned = ownedPositions();
    if (owned.size === 0) return false;
    return field.adjacent_positions.some((p) => owned.has(p));
  }

  async function handleClaim(fieldId: string, takeover = false) {
    if (!member) return;
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    const cost = takeover ? rules.takeover_cost : rules.field_claim_cost;

    await supabase
      .from('fields')
      .update({ owner_id: member.id, status: 'owned', siege_status: 'secured' })
      .eq('id', fieldId);

    await supabase
      .from('family_members')
      .update({
        underlings: member.underlings - cost,
        season_victory_points: member.season_victory_points + 1,
        total_victory_points: member.total_victory_points + 1,
      })
      .eq('id', member.id);

    if (takeover && field.owner_id) {
      const prevOwner = members.find((m) => m.id === field.owner_id);
      if (prevOwner) {
        await supabase
          .from('family_members')
          .update({
            season_victory_points: Math.max(0, prevOwner.season_victory_points - 1),
            total_victory_points: Math.max(0, prevOwner.total_victory_points - 1),
          })
          .eq('id', prevOwner.id);
      }
    }

    toast(takeover ? 'Feld übernommen!' : 'Feld erobert!');
    loadMap();
  }

  if (loading) return <div className="page"><p className="muted">Lädt...</p></div>;
  if (!member) return null;

  const selectedField = fields.find((f) => f.id === selectedId);
  const ownerName = (id: string | null) => id ? (members.find((m) => m.id === id)?.name ?? '?') : 'Frei';
  const ownerColor = (id: string | null) => {
    if (!id) return null;
    const idx = members.findIndex((m) => m.id === id);
    return idx >= 0 ? OWNER_COLORS[idx % OWNER_COLORS.length] : '#64748b';
  };
  const productionIcon = (f: Field) =>
    f.production_value === 0 ? '·' : f.production_type === 'gold' ? '💰' : '🧱';

  // Layout bounds for absolute hex positioning.
  const positions = fields.map((f) => {
    const { q, r } = parsePos(f.grid_position);
    return axialToPixel(q, r, HEX_SIZE);
  });
  const hexW = Math.sqrt(3) * HEX_SIZE;
  const hexH = 2 * HEX_SIZE;
  const minX = positions.length ? Math.min(...positions.map((p) => p.x)) : 0;
  const minY = positions.length ? Math.min(...positions.map((p) => p.y)) : 0;
  const maxX = positions.length ? Math.max(...positions.map((p) => p.x)) : 0;
  const maxY = positions.length ? Math.max(...positions.map((p) => p.y)) : 0;
  const boardW = maxX - minX + hexW;
  const boardH = maxY - minY + hexH;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reichskarte</h1>
        <p className="muted">
          {isAdmin
            ? 'Überblick über alle Gebiete deiner Familie. Wähle ein Feld für die vollständige Detailansicht.'
            : 'Erobere angrenzende Felder mit Untertanen. Jedes Feld = 1 Siegpunkt.'}
        </p>
      </div>

      {!seasonId && (
        <div className="card card-pad-md"><p className="muted">Keine aktive Saison – starte eine Saison, um die Karte zu nutzen.</p></div>
      )}

      {seasonId && fields.length === 0 && (
        <div className="card card-pad-md map-empty">
          <p className="muted">Für diese Saison wurde noch keine Karte erstellt.</p>
          {canManageMap && (
            <Button onClick={() => handleGenerate(false)} loading={working}>
              Karte generieren ({rules.map_size} Felder)
            </Button>
          )}
        </div>
      )}

      {fields.length > 0 && (
        <div className="map-layout">
          <div className="map-board-wrap">
            {canManageMap && (
              <div className="map-toolbar">
                <Button size="sm" variant="ghost" onClick={() => handleGenerate(true)} loading={working}>
                  Karte neu generieren
                </Button>
              </div>
            )}
            <div className="hex-board" style={{ width: boardW, height: boardH }}>
              {fields.map((field) => {
                const { q, r } = parsePos(field.grid_position);
                const { x, y } = axialToPixel(q, r, HEX_SIZE);
                const isOwned = field.owner_id === member.id;
                const claimable = canClaim(field);
                const takeable = canTakeover(field);
                const color = ownerColor(field.owner_id);

                return (
                  <button
                    key={field.id}
                    className={`hex-tile ${selectedId === field.id ? 'selected' : ''} ${claimable ? 'claimable' : ''} ${takeable ? 'takeover' : ''} ${isOwned ? 'mine' : ''}`}
                    style={{
                      left: x - minX,
                      top: y - minY,
                      width: hexW,
                      height: hexH,
                      background: color ?? undefined,
                    }}
                    onClick={() => setSelectedId(field.id)}
                    title={field.name}
                  >
                    <span className="hex-icon">{productionIcon(field)}</span>
                    <span className="hex-name">{field.name}</span>
                    {field.owner_id && <span className="hex-garrison">{isOwned ? '★' : '⚔'}</span>}
                  </button>
                );
              })}
            </div>
            <div className="map-legend">
              <span>💰 Gold</span><span>🧱 Baumaterial</span><span>· Neutral</span>
              <span className="legend-mine">★ Dein Feld</span>
            </div>
          </div>

          {selectedField && (
            <div className="card card-pad-md map-detail">
              <div className="detail-header">
                <h3>{selectedField.name}</h3>
                <Pill tone={selectedField.owner_id === member.id ? 'good' : selectedField.owner_id ? 'warn' : 'neutral'}>
                  {selectedField.owner_id === member.id ? 'Deins' : selectedField.owner_id ? 'Besetzt' : 'Frei'}
                </Pill>
              </div>
              <div className="detail-rows">
                <div className="detail-row"><span>Typ</span><strong>{selectedField.field_type}</strong></div>
                <div className="detail-row"><span>Produktion</span><strong>{selectedField.production_value === 0 ? 'Keine' : `${selectedField.production_type === 'gold' ? 'Gold' : 'Baumaterial'} +${selectedField.production_value}`}</strong></div>
                <div className="detail-row"><span>Besitzer</span><strong>{ownerName(selectedField.owner_id)}</strong></div>
                <div className="detail-row"><span>Wert</span><strong>1 Siegpunkt</strong></div>
                {isAdmin && (
                  <>
                    <div className="detail-row"><span>Status</span><strong>{selectedField.status}</strong></div>
                    <div className="detail-row"><span>Belagerung</span><strong>{selectedField.siege_status}</strong></div>
                    <div className="detail-row"><span>Angrenzend</span><strong>{selectedField.adjacent_positions.length} Felder</strong></div>
                    <div className="detail-row"><span>Position</span><strong>{selectedField.grid_position}</strong></div>
                  </>
                )}
              </div>
              {isAdmin ? (
                <p className="muted small">Administratoren verwalten die Karte, nehmen aber nicht aktiv am Spiel teil.</p>
              ) : (
                <div className="detail-actions">
                  <Button onClick={() => handleClaim(selectedField.id)} disabled={!canClaim(selectedField)}>
                    Erobern ({rules.field_claim_cost} Untertanen)
                  </Button>
                  <Button variant="secondary" onClick={() => handleClaim(selectedField.id, true)} disabled={!canTakeover(selectedField)}>
                    Übernehmen ({rules.takeover_cost} Untertanen)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
