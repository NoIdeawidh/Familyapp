export const PERMISSIONS = {
  // Task permissions
  VIEW_OWN_TASKS: 'view_own_tasks',
  COMPLETE_OWN_TASKS: 'complete_own_tasks',
  CREATE_TASKS: 'create_tasks',
  EDIT_TASKS: 'edit_tasks',
  DELETE_TASKS: 'delete_tasks',
  APPROVE_TASKS: 'approve_tasks',

  // Reward permissions
  BUY_REWARDS: 'buy_rewards',
  CREATE_REWARDS: 'create_rewards',
  EDIT_REWARDS: 'edit_rewards',
  DELETE_REWARDS: 'delete_rewards',

  // Map permissions
  VIEW_MAP: 'view_map',
  CLAIM_FIELDS: 'claim_fields',
  MANAGE_MAP: 'manage_map',

  // Stats/Leaderboard
  VIEW_OWN_STATS: 'view_own_stats',
  VIEW_LEADERBOARD: 'view_leaderboard',

  // Season management
  MANAGE_SEASONS: 'manage_seasons',

  // User/family management
  MANAGE_MEMBERS: 'manage_members',
  INVITE_MEMBERS: 'invite_members',
  MANAGE_PERMISSIONS: 'manage_permissions',
  RESET_PINS: 'reset_pins',

  // Admin
  ACCESS_ADMIN: 'access_admin',
  MANAGE_RULES: 'manage_rules',
  ADJUST_RESOURCES: 'adjust_resources',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_DEFAULTS: Record<'admin' | 'parent' | 'player', Permission[]> = {
  admin: Object.values(PERMISSIONS),
  parent: [
    PERMISSIONS.VIEW_OWN_TASKS,
    PERMISSIONS.COMPLETE_OWN_TASKS,
    PERMISSIONS.CREATE_TASKS,
    PERMISSIONS.EDIT_TASKS,
    PERMISSIONS.APPROVE_TASKS,
    PERMISSIONS.BUY_REWARDS,
    PERMISSIONS.CREATE_REWARDS,
    PERMISSIONS.EDIT_REWARDS,
    PERMISSIONS.VIEW_MAP,
    PERMISSIONS.CLAIM_FIELDS,
    PERMISSIONS.VIEW_OWN_STATS,
    PERMISSIONS.VIEW_LEADERBOARD,
    PERMISSIONS.MANAGE_SEASONS,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.INVITE_MEMBERS,
    PERMISSIONS.RESET_PINS,
    PERMISSIONS.ACCESS_ADMIN,
    PERMISSIONS.ADJUST_RESOURCES,
  ],
  player: [
    PERMISSIONS.VIEW_OWN_TASKS,
    PERMISSIONS.COMPLETE_OWN_TASKS,
    PERMISSIONS.BUY_REWARDS,
    PERMISSIONS.VIEW_MAP,
    PERMISSIONS.CLAIM_FIELDS,
    PERMISSIONS.VIEW_OWN_STATS,
    PERMISSIONS.VIEW_LEADERBOARD,
  ],
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  [PERMISSIONS.VIEW_OWN_TASKS]: 'Eigene Aufgaben sehen',
  [PERMISSIONS.COMPLETE_OWN_TASKS]: 'Eigene Aufgaben erledigen',
  [PERMISSIONS.CREATE_TASKS]: 'Aufgaben erstellen',
  [PERMISSIONS.EDIT_TASKS]: 'Aufgaben bearbeiten',
  [PERMISSIONS.DELETE_TASKS]: 'Aufgaben löschen',
  [PERMISSIONS.APPROVE_TASKS]: 'Aufgaben bestätigen',
  [PERMISSIONS.BUY_REWARDS]: 'Belohnungen kaufen',
  [PERMISSIONS.CREATE_REWARDS]: 'Belohnungen erstellen',
  [PERMISSIONS.EDIT_REWARDS]: 'Belohnungen bearbeiten',
  [PERMISSIONS.DELETE_REWARDS]: 'Belohnungen löschen',
  [PERMISSIONS.VIEW_MAP]: 'Karte ansehen',
  [PERMISSIONS.CLAIM_FIELDS]: 'Felder erobern',
  [PERMISSIONS.MANAGE_MAP]: 'Karte verwalten',
  [PERMISSIONS.VIEW_OWN_STATS]: 'Eigene Statistiken ansehen',
  [PERMISSIONS.VIEW_LEADERBOARD]: 'Rangliste ansehen',
  [PERMISSIONS.MANAGE_SEASONS]: 'Saisons verwalten',
  [PERMISSIONS.MANAGE_MEMBERS]: 'Mitglieder verwalten',
  [PERMISSIONS.INVITE_MEMBERS]: 'Mitglieder einladen',
  [PERMISSIONS.MANAGE_PERMISSIONS]: 'Rechte verwalten',
  [PERMISSIONS.RESET_PINS]: 'PINs zurücksetzen',
  [PERMISSIONS.ACCESS_ADMIN]: 'Admin-Bereich',
  [PERMISSIONS.MANAGE_RULES]: 'Regeln verwalten',
  [PERMISSIONS.ADJUST_RESOURCES]: 'Ressourcen anpassen',
};
