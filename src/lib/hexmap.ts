import { supabase } from './supabase';

// Axial hex coordinates. Six neighbours per tile.
const HEX_DIRECTIONS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

export interface GeneratedField {
  q: number;
  r: number;
  grid_position: string;
  name: string;
  field_type: string;
  production_type: 'gold' | 'buildingMaterial';
  production_value: number;
  adjacent_positions: string[];
}

const pos = (q: number, r: number) => `${q},${r}`;

const FIELD_NAMES = [
  'Grünau', 'Steintal', 'Goldbach', 'Hügelfeld', 'Dunkelwald', 'Sonnenau',
  'Felsberg', 'Nordmark', 'Südhang', 'Weststein', 'Ostfurt', 'Silbersee',
  'Kupfertal', 'Eisenberg', 'Morgental', 'Abendfeld', 'Windhöhe', 'Talgrund',
  'Sturmkap', 'Nebelmoor', 'Bärenwald', 'Wolfstal', 'Adlerhorst', 'Rabenfels',
  'Lindenau', 'Eichgrund', 'Birkenhain', 'Ahorntal', 'Distelfeld', 'Farnhang',
];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Deterministic-ish organic blob grown from the centre so the map is never a
// perfect hexagon. Frontier tiles are picked at random which yields a natural,
// irregular coastline.
export function generateHexMap(size: number, seed = Date.now()): GeneratedField[] {
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  const target = Math.max(7, Math.min(60, size));
  const chosen = new Map<string, [number, number]>();
  chosen.set(pos(0, 0), [0, 0]);
  const frontier: Array<[number, number]> = [[0, 0]];

  while (chosen.size < target && frontier.length > 0) {
    const idx = Math.floor(rng() * frontier.length);
    const [q, r] = frontier[idx];
    const emptyNeighbours = HEX_DIRECTIONS
      .map(([dq, dr]) => [q + dq, r + dr] as [number, number])
      .filter(([nq, nr]) => !chosen.has(pos(nq, nr)));

    if (emptyNeighbours.length === 0) {
      frontier.splice(idx, 1);
      continue;
    }

    const [nq, nr] = pick(emptyNeighbours, rng);
    chosen.set(pos(nq, nr), [nq, nr]);
    frontier.push([nq, nr]);
  }

  const names = [...FIELD_NAMES];
  const usedNames = new Set<string>();

  return [...chosen.values()].map(([q, r], i) => {
    const roll = rng();
    let field_type: string;
    let production_type: 'gold' | 'buildingMaterial';
    let production_value: number;
    if (roll < 0.4) {
      field_type = 'Goldfeld';
      production_type = 'gold';
      production_value = 1 + Math.floor(rng() * 3);
    } else if (roll < 0.8) {
      field_type = 'Baumaterialfeld';
      production_type = 'buildingMaterial';
      production_value = 1 + Math.floor(rng() * 3);
    } else {
      field_type = 'Neutralfeld';
      production_type = rng() < 0.5 ? 'gold' : 'buildingMaterial';
      production_value = 0;
    }

    let name = names.length ? names.splice(Math.floor(rng() * names.length), 1)[0] : '';
    if (!name || usedNames.has(name)) name = `Feld ${i + 1}`;
    usedNames.add(name);

    const adjacent_positions = HEX_DIRECTIONS
      .map(([dq, dr]) => pos(q + dq, r + dr))
      .filter((p) => chosen.has(p));

    return { q, r, grid_position: pos(q, r), name, field_type, production_type, production_value, adjacent_positions };
  });
}

// Pointy-top axial -> pixel. Used for organic layout.
export function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (q + r / 2),
    y: size * 1.5 * r,
  };
}

export async function generateAndInsertMap(
  familyId: string,
  seasonId: string,
  size: number
): Promise<number> {
  const map = generateHexMap(size);
  const rows = map.map((f) => ({
    family_id: familyId,
    season_id: seasonId,
    name: f.name,
    grid_position: f.grid_position,
    field_type: f.field_type,
    adjacent_positions: f.adjacent_positions,
    production_type: f.production_type,
    production_value: f.production_value,
    status: 'free' as const,
  }));
  const { error } = await supabase.from('fields').insert(rows);
  if (error) throw error;
  return rows.length;
}
