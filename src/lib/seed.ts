import { addMonths } from './utils';
import type { Field, GameState, Reward, Season, Task, User } from './types';

function createFields(): Field[] {
  const names = [
    ['A1', 'Wiese'], ['A2', 'Hof'], ['A3', 'Garten'], ['A4', 'Schuppen'],
    ['B1', 'Küche'], ['B2', 'Flur'], ['B3', 'Werkbank'], ['B4', 'Müllplatz'],
    ['C1', 'Zimmer'], ['C2', 'Bad'], ['C3', 'Waschraum'], ['C4', 'Terrasse'],
  ];

  const adjacency: Record<string, string[]> = {
    A1: ['A2', 'B1'], A2: ['A1', 'A3', 'B2'], A3: ['A2', 'A4', 'B3'], A4: ['A3', 'B4'],
    B1: ['A1', 'B2', 'C1'], B2: ['A2', 'B1', 'B3', 'C2'], B3: ['A3', 'B2', 'B4', 'C3'], B4: ['A4', 'B3', 'C4'],
    C1: ['B1', 'C2'], C2: ['B2', 'C1', 'C3'], C3: ['B3', 'C2', 'C4'], C4: ['B4', 'C3'],
  };

  return names.map(([id, name], index) => ({
    id,
    name,
    type: index % 3 === 0 ? 'Außenposten' : index % 3 === 1 ? 'Siedlung' : 'Bezirk',
    ownerId: null,
    adjacentFieldIds: adjacency[id],
    status: 'free',
    productionType: index % 2 === 0 ? 'gold' : 'buildingMaterial',
    productionValue: index % 2 === 0 ? 2 : 1,
    siegeStatus: 'none',
    victoryPointValue: 1,
    lastCollectedSeasonId: null,
  }));
}

function createTasks(): Task[] {
  return [
    {
      id: 'task_1',
      title: 'Küche aufräumen',
      description: 'Spülmaschine ausräumen, Arbeitsfläche frei machen und die Tische sauber hinterlassen.',
      type: 'private',
      assignedTo: 'player_1',
      valueInUnderlings: 3,
      needsApproval: true,
      repeatable: true,
      status: 'open',
      category: 'Küche',
      createdBy: 'admin_1',
      completions: [],
    },
    {
      id: 'task_2',
      title: 'Müll rausbringen',
      description: 'Restmüll und Papier zur richtigen Tonne bringen.',
      type: 'open',
      assignedTo: null,
      valueInUnderlings: 2,
      needsApproval: false,
      repeatable: true,
      status: 'open',
      category: 'Müll',
      createdBy: 'admin_1',
      completions: [],
    },
    {
      id: 'task_3',
      title: 'Zimmer ordentlich halten',
      description: 'Bett machen, Boden frei räumen, Kleidung wegräumen.',
      type: 'private',
      assignedTo: 'player_2',
      valueInUnderlings: 4,
      needsApproval: false,
      repeatable: true,
      status: 'open',
      category: 'Zimmer',
      createdBy: 'parent_1',
      completions: [],
    },
    {
      id: 'task_4',
      title: 'Gartenrunde',
      description: 'Einmal im Garten nach dem Rechten sehen und kleine Arbeiten erledigen.',
      type: 'open',
      assignedTo: null,
      valueInUnderlings: 3,
      needsApproval: true,
      repeatable: false,
      status: 'open',
      category: 'Garten',
      createdBy: 'parent_1',
      completions: [],
    },
  ];
}

function createRewards(): Reward[] {
  return [
    {
      id: 'reward_1',
      name: '30 Minuten extra Bildschirmzeit',
      description: 'Eine klare Sonderregel für einen Tag.',
      costInGold: 12,
      type: 'special-right',
      active: true,
      redeemedBy: [],
    },
    {
      id: 'reward_2',
      name: 'Wunschessen am Freitag',
      description: 'Ein Familienvorteil für eine Mahlzeit.',
      costInGold: 20,
      type: 'family-benefit',
      active: true,
      redeemedBy: [],
    },
    {
      id: 'reward_3',
      name: 'Avatar-Farbe wechseln',
      description: 'Kosmetische Änderung für das Profil.',
      costInGold: 6,
      type: 'cosmetic',
      active: true,
      redeemedBy: [],
    },
    {
      id: 'reward_4',
      name: 'Einmaliger Untertanenbonus',
      description: 'Kleiner Spielvorteil für den Reichsausbau.',
      costInGold: 18,
      type: 'game-boost',
      active: true,
      redeemedBy: [],
    },
  ];
}

function createUsers(): User[] {
  return [
    {
      id: 'admin_1',
      name: 'Admin',
      role: 'admin',
      active: true,
      avatar: '👑',
      gold: 50,
      buildingMaterial: 25,
      underlings: 10,
      totalVictoryPoints: 2,
      seasonVictoryPoints: 2,
    },
    {
      id: 'parent_1',
      name: 'Elternteil',
      role: 'parent',
      active: true,
      avatar: '🛡️',
      gold: 25,
      buildingMaterial: 15,
      underlings: 6,
      totalVictoryPoints: 1,
      seasonVictoryPoints: 1,
    },
    {
      id: 'player_1',
      name: 'Kind 1',
      role: 'player',
      active: true,
      avatar: '🦁',
      gold: 8,
      buildingMaterial: 4,
      underlings: 4,
      totalVictoryPoints: 1,
      seasonVictoryPoints: 1,
    },
    {
      id: 'player_2',
      name: 'Kind 2',
      role: 'player',
      active: true,
      avatar: '🦊',
      gold: 8,
      buildingMaterial: 4,
      underlings: 5,
      totalVictoryPoints: 1,
      seasonVictoryPoints: 1,
    },
  ];
}

export function createInitialState(): GameState {
  const now = new Date();
  const season: Season = {
    id: 'season_1',
    name: 'Saison 1',
    startDate: now.toISOString(),
    endDate: addMonths(now, 2).toISOString(),
    activeMapId: 'map_1',
    active: true,
    archived: false,
  };

  return {
    users: createUsers(),
    tasks: createTasks(),
    fields: createFields(),
    rewards: createRewards(),
    seasons: [season],
    activeSeasonId: season.id,
    archivedMaps: {},
    rules: {
      underlingsPerTask: 'Aufgaben bringen Untertanen. Untertanen entstehen nur über Aufgaben.',
      fieldClaimCost: 1,
      takeoverCost: 2,
      seasonLengthMonths: 2,
    },
    nextIds: {
      user: 5,
      task: 5,
      field: 13,
      reward: 5,
      season: 2,
      map: 2,
    },
  };
}
