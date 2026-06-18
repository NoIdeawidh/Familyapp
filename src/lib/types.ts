export type Role = 'admin' | 'parent' | 'player';
export type TaskType = 'private' | 'open';
export type TaskStatus = 'open' | 'pending' | 'done';
export type FieldStatus = 'free' | 'owned' | 'contested' | 'secured';
export type SiegeStatus = 'none' | 'sieged' | 'secured';
export type ProductionType = 'gold' | 'buildingMaterial';
export type RewardType = 'special-right' | 'cosmetic' | 'family-benefit' | 'game-boost';

export interface User {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  avatar?: string;
  gold: number;
  buildingMaterial: number;
  underlings: number;
  totalVictoryPoints: number;
  seasonVictoryPoints: number;
}

export interface TaskCompletion {
  userId: string;
  seasonId: string;
  approved: boolean;
  completedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  assignedTo: string | null;
  valueInUnderlings: number;
  needsApproval: boolean;
  repeatable: boolean;
  status: TaskStatus;
  category: string;
  createdBy: string;
  completions: TaskCompletion[];
}

export interface Field {
  id: string;
  name: string;
  type: string;
  ownerId: string | null;
  adjacentFieldIds: string[];
  status: FieldStatus;
  productionType: ProductionType;
  productionValue: number;
  siegeStatus: SiegeStatus;
  victoryPointValue: 1;
  lastCollectedSeasonId: string | null;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  costInGold: number;
  type: RewardType;
  active: boolean;
  redeemedBy: string[];
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  activeMapId: string;
  active: boolean;
  archived: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  seasonVictoryPoints: number;
  totalVictoryPoints: number;
  rank: number;
}

export interface Rules {
  underlingsPerTask: string;
  fieldClaimCost: number;
  takeoverCost: number;
  seasonLengthMonths: number;
}

export interface GameState {
  users: User[];
  tasks: Task[];
  fields: Field[];
  rewards: Reward[];
  seasons: Season[];
  activeSeasonId: string;
  archivedMaps: Record<string, Field[]>;
  rules: Rules;
  nextIds: Record<string, number>;
}
