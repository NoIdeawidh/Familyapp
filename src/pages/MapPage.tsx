import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { useToast } from '../components/ui/Toast';


import type { Field, FamilyMember } from '../lib/types';

type Member = FamilyMember;

export function MapPage() {
  const { member, family } = useAuth();
  const { toast } = useToast();
  const [fields, setFields] = useState<Field[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rules, setRules] = useState({ field_claim_cost: 1, takeover_cost: 2 });
  const [loading, setLoading] = useState(true);

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
      .single();

    if (!season) { setLoading(false); return; }

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
      .select('field_claim_cost, takeover_cost')
      .eq('family_id', family.id)
      .single();

    setFields(fieldsData ?? []);
    setMembers(membersData ?? []);
    if (rulesData) setRules(rulesData);
    if (fieldsData?.length) setSelectedId(fieldsData[0].id);
    setLoading(false);
  }

  function canClaim(field: Field): boolean {
    if (!member || field.owner_id === member.id) return false;
    if (member.underlings < rules.field_claim_cost) return false;
    if (field.status !== 'free') return false;

    const ownedPositions = new Set(
      fields.filter((f) => f.owner_id === member.id).map((f) => f.grid_position)
    );

    if (ownedPositions.size === 0) return true; // First field
    return field.adjacent_positions.some((pos) => ownedPositions.has(pos));
  }

  function canTakeover(field: Field): boolean {
    if (!member || field.owner_id === member.id || !field.owner_id) return false;
    if (member.underlings < rules.takeover_cost) return false;

    const ownedPositions = new Set(
      fields.filter((f) => f.owner_id === member.id).map((f) => f.grid_position)
    );

    if (ownedPositions.size === 0) return false;
    return field.adjacent_positions.some((pos) => ownedPositions.has(pos));
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

    // If takeover, remove VP from previous owner
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

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reichskarte</h1>
        <p className="muted">Erobere angrenzende Felder mit Untertanen. Jedes Feld = 1 Siegpunkt.</p>
      </div>

      <div className="map-layout">
        <div className="map-grid">
          {fields.map((field) => {
            const isOwned = field.owner_id === member.id;
            const claimable = canClaim(field);
            const takeable = canTakeover(field);

            return (
              <button
                key={field.id}
                className={`field-tile ${selectedId === field.id ? 'selected' : ''} ${claimable ? 'claimable' : ''} ${takeable ? 'takeover' : ''} ${isOwned ? 'owned-by-me' : ''}`}
                onClick={() => setSelectedId(field.id)}
              >
                <div className="field-top">
                  <strong>{field.name}</strong>
                </div>
                <div className="field-bottom">
                  <span className="small">{field.production_type === 'gold' ? '💰' : '🧱'} +{field.production_value}</span>
                  <span className="small">{isOwned ? 'Deins' : field.owner_id ? '⚔️' : '◻️'}</span>
                </div>
              </button>
            );
          })}
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
              <div className="detail-row"><span>Produktion</span><strong>{selectedField.production_type === 'gold' ? 'Gold' : 'Baumaterial'} +{selectedField.production_value}</strong></div>
              <div className="detail-row"><span>Besitzer</span><strong>{ownerName(selectedField.owner_id)}</strong></div>
              <div className="detail-row"><span>Wert</span><strong>1 Siegpunkt</strong></div>
            </div>
            <div className="detail-actions">
              <Button onClick={() => handleClaim(selectedField.id)} disabled={!canClaim(selectedField)}>
                Erobern ({rules.field_claim_cost} Untertanen)
              </Button>
              <Button variant="secondary" onClick={() => handleClaim(selectedField.id, true)} disabled={!canTakeover(selectedField)}>
                Übernehmen ({rules.takeover_cost} Untertanen)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
