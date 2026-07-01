export interface Family {
  id: string;
  name: string;
  created_at: string;
  settings: Record<string, unknown>;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  auth_user_id: string | null;
  name: string;
  role: 'admin' | 'parent' | 'player';
  avatar: string;
  auth_email: string | null;
  pin_hash: string | null;
  active: boolean;
  gold: number;
  building_material: number;
  underlings: number;
  total_victory_points: number;
  season_victory_points: number;
  created_at: string;
}

export interface MemberPermission {
  id: string;
  member_id: string;
  permission: string;
  granted: boolean;
}

export interface InviteCode {
  id: string;
  family_id: string;
  code: string;
  role: 'admin' | 'parent' | 'player';
  created_by: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
}

export interface Season {
  id: string;
  family_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
  archived: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  family_id: string;
  title: string;
  description: string;
  type: 'private' | 'open';
  assigned_to: string | null;
  value_in_underlings: number;
  needs_approval: boolean;
  repeatable: boolean;
  recurrence: Recurrence;
  recurrence_interval_days: number | null;
  due_date: string | null;
  status: 'open' | 'pending' | 'done';
  category: string;
  created_by: string;
  created_at: string;
}

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface TaskCompletion {
  id: string;
  task_id: string;
  member_id: string;
  season_id: string;
  approved: boolean;
  approved_by: string | null;
  completed_at: string;
}

export interface Field {
  id: string;
  family_id: string;
  season_id: string;
  name: string;
  grid_position: string;
  field_type: string;
  owner_id: string | null;
  adjacent_positions: string[];
  status: 'free' | 'owned' | 'contested' | 'secured';
  production_type: 'gold' | 'buildingMaterial';
  production_value: number;
  siege_status: 'none' | 'sieged' | 'secured';
  last_collected_season_id: string | null;
  created_at: string;
}

export interface Reward {
  id: string;
  family_id: string;
  name: string;
  description: string;
  cost_in_gold: number;
  type: 'special-right' | 'cosmetic' | 'family-benefit' | 'game-boost';
  active: boolean;
  created_at: string;
}

export interface RewardRedemption {
  id: string;
  reward_id: string;
  member_id: string;
  redeemed_at: string;
}

export interface FamilyRules {
  id: string;
  family_id: string;
  field_claim_cost: number;
  takeover_cost: number;
  season_length_months: number;
}
