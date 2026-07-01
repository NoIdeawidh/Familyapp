import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

export function AdminRules() {
  const { family } = useAuth();
  const { toast } = useToast();
  const [fieldClaimCost, setFieldClaimCost] = useState(1);
  const [takeoverCost, setTakeoverCost] = useState(2);
  const [seasonLengthWeeks, setSeasonLengthWeeks] = useState(4);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!family) return;

    async function load() {
      const { data } = await supabase
        .from('family_rules')
        .select('*')
        .eq('family_id', family!.id)
        .single();

      if (data) {
        setFieldClaimCost(data.field_claim_cost);
        setTakeoverCost(data.takeover_cost);
        setSeasonLengthWeeks(data.season_length_weeks ?? 4);
      }
      setLoading(false);
    }

    load();
  }, [family]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!family) return;

    await supabase
      .from('family_rules')
      .update({
        field_claim_cost: fieldClaimCost,
        takeover_cost: takeoverCost,
        season_length_weeks: seasonLengthWeeks,
      })
      .eq('family_id', family.id);

    toast('Regeln gespeichert');
  }

  if (loading) return <p className="muted">Lädt...</p>;

  return (
    <div>
      <h2>Regeln & Balancing</h2>
      <p className="muted">Hier werden die grundlegenden Spielwerte festgelegt.</p>

      <form onSubmit={handleSave} className="card card-pad-md admin-form">
        <div className="form-grid-2">
          <Input
            label="Feld erobern (Kosten in Untertanen)"
            type="number"
            value={fieldClaimCost}
            onChange={(e) => setFieldClaimCost(Number(e.target.value))}
            min={1}
          />
          <Input
            label="Feld übernehmen (Kosten in Untertanen)"
            type="number"
            value={takeoverCost}
            onChange={(e) => setTakeoverCost(Number(e.target.value))}
            min={1}
          />
          <Input
            label="Saisonlänge (Wochen)"
            type="number"
            value={seasonLengthWeeks}
            onChange={(e) => setSeasonLengthWeeks(Number(e.target.value))}
            min={1}
            max={52}
          />
        </div>
        <Button type="submit" size="sm">Regeln speichern</Button>
      </form>
    </div>
  );
}
