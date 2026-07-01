import type { Reward } from './types';

export interface TaskTemplate {
  title: string;
  description: string;
  category: string;
  value_in_underlings: number;
}

export interface RewardTemplate {
  name: string;
  description: string;
  cost_in_gold: number;
  type: Reward['type'];
}

// Suggested starter tasks offered by the setup wizard. Selectable, editable
// later on the Tasks page.
export const TASK_TEMPLATES: TaskTemplate[] = [
  { title: 'Zimmer aufräumen', description: 'Das eigene Zimmer ordentlich aufräumen.', category: 'Haushalt', value_in_underlings: 3 },
  { title: 'Tisch decken', description: 'Den Esstisch für die Mahlzeit decken.', category: 'Haushalt', value_in_underlings: 1 },
  { title: 'Hausaufgaben erledigen', description: 'Alle Hausaufgaben vollständig erledigen.', category: 'Schule', value_in_underlings: 3 },
  { title: 'Müll rausbringen', description: 'Den Müll sortieren und rausbringen.', category: 'Haushalt', value_in_underlings: 2 },
  { title: 'Spülmaschine ausräumen', description: 'Die saubere Spülmaschine ausräumen.', category: 'Haushalt', value_in_underlings: 2 },
  { title: 'Haustier versorgen', description: 'Füttern und für frisches Wasser sorgen.', category: 'Tiere', value_in_underlings: 2 },
  { title: 'Wäsche zusammenlegen', description: 'Die saubere Wäsche zusammenlegen und wegräumen.', category: 'Haushalt', value_in_underlings: 2 },
  { title: 'Staubsaugen', description: 'Ein Zimmer oder den Flur staubsaugen.', category: 'Haushalt', value_in_underlings: 3 },
];

// Suggested starter rewards offered by the setup wizard.
export const REWARD_TEMPLATES: RewardTemplate[] = [
  { name: 'Extra Medienzeit', description: '30 Minuten zusätzliche Bildschirmzeit.', cost_in_gold: 15, type: 'family-benefit' },
  { name: 'Später ins Bett', description: 'Einmal 30 Minuten später schlafen gehen.', cost_in_gold: 20, type: 'family-benefit' },
  { name: 'Süßigkeit', description: 'Eine Süßigkeit deiner Wahl.', cost_in_gold: 10, type: 'family-benefit' },
  { name: 'Familienaktivität wählen', description: 'Das nächste Familienspiel oder den Ausflug bestimmen.', cost_in_gold: 30, type: 'family-benefit' },
  { name: 'Wunschessen', description: 'Das Abendessen für einen Tag aussuchen.', cost_in_gold: 25, type: 'family-benefit' },
  { name: 'Filmabendwahl', description: 'Den Film für den Familienabend auswählen.', cost_in_gold: 20, type: 'family-benefit' },
];
