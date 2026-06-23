import type { Field, GameState, Reward, Task, User } from './types';
import { addMonths } from './utils';

export function getCurrentSeason(state: GameState) {
  return state.seasons.find((season) => season.id === state.activeSeasonId) ?? state.seasons[0];
}

export function getUser(state: GameState, userId: string | null | undefined): User | undefined {
  if (!userId) return undefined;
  return state.users.find((user) => user.id === userId);
}

export function getOwnedFields(state: GameState, userId: string): Field[] {
  return state.fields.filter((field) => field.ownerId === userId);
}

export function hasAdjacentOwnedField(state: GameState, userId: string, field: Field): boolean {
  const ownedIds = new Set(getOwnedFields(state, userId).map((item) => item.id));
  return field.adjacentFieldIds.some((id) => ownedIds.has(id));
}

export function canClaimField(state: GameState, userId: string, field: Field): boolean {
  const user = getUser(state, userId);
  if (!user || user.underlings < state.rules.fieldClaimCost) return false;
  if (field.ownerId === userId) return false;
  const owned = getOwnedFields(state, userId);
  if (owned.length === 0) return field.status === 'free';
  return field.status === 'free' && hasAdjacentOwnedField(state, userId, field);
}

export function canTakeOverField(state: GameState, userId: string, field: Field): boolean {
  const user = getUser(state, userId);
  if (!user || user.underlings < state.rules.takeoverCost) return false;
  if (field.ownerId === userId) return false;
  const owned = getOwnedFields(state, userId);
  if (owned.length === 0) return false;
  return field.ownerId !== null && hasAdjacentOwnedField(state, userId, field);
}

export function recalculateRanks(state: GameState): GameState {
  const seasonSorted = [...state.users].sort((a, b) => {
    if (b.seasonVictoryPoints !== a.seasonVictoryPoints) return b.seasonVictoryPoints - a.seasonVictoryPoints;
    if (b.totalVictoryPoints !== a.totalVictoryPoints) return b.totalVictoryPoints - a.totalVictoryPoints;
    return a.name.localeCompare(b.name);
  });
  return { ...state, users: seasonSorted };
}

export function completeTask(state: GameState, taskId: string, userId: string): GameState {
  const currentSeason = getCurrentSeason(state);
  const user = getUser(state, userId);
  const task = state.tasks.find((item) => item.id === taskId);
  if (!user || !task) return state;
  if (task.type === 'private' && task.assignedTo !== userId && user.role === 'player') return state;

  const alreadyDoneThisSeason = task.completions.some((entry) => entry.userId === userId && entry.seasonId === currentSeason.id);
  if (alreadyDoneThisSeason) return state;

  const completion = {
    userId,
    seasonId: currentSeason.id,
    approved: !task.needsApproval,
    completedAt: new Date().toISOString(),
  };

  const nextUsers = state.users.map((item) => {
    if (item.id !== userId) return item;
    return {
      ...item,
      underlings: item.underlings + (task.needsApproval ? 0 : task.valueInUnderlings),
    };
  });

  const nextTasks = state.tasks.map((item): Task => {
    if (item.id !== taskId) return item;
    return {
      ...item,
      completions: [...item.completions, completion],
      status: task.needsApproval ? 'pending' : (task.repeatable ? 'open' : 'done'),
    };
  });

  return recalculateRanks({
    ...state,
    users: nextUsers,
    tasks: nextTasks,
  });
}

export function approveTaskCompletion(state: GameState, taskId: string, userId: string, approverId: string): GameState {
  const task = state.tasks.find((item) => item.id === taskId);
  const approver = getUser(state, approverId);
  if (!task || !approver || (approver.role !== 'admin' && approver.role !== 'parent')) return state;

  const completionIndex = task.completions.findIndex((entry) => entry.userId === userId && entry.approved === false);
  if (completionIndex < 0) return state;

  const nextUsers = state.users.map((item) => {
    if (item.id !== userId) return item;
    return { ...item, underlings: item.underlings + task.valueInUnderlings };
  });

  const nextTasks = state.tasks.map((item): Task => {
    if (item.id !== taskId) return item;
    const completions = item.completions.map((entry, index) => index === completionIndex ? { ...entry, approved: true } : entry);
    return {
      ...item,
      completions,
      status: item.repeatable ? 'open' : 'done',
    };
  });

  return recalculateRanks({
    ...state,
    users: nextUsers,
    tasks: nextTasks,
  });
}

export function claimField(state: GameState, userId: string, fieldId: string, takeover = false): GameState {
  const user = getUser(state, userId);
  const field = state.fields.find((item) => item.id === fieldId);
  if (!user || !field) return state;

  const canDo = takeover ? canTakeOverField(state, userId, field) : canClaimField(state, userId, field);
  if (!canDo) return state;

  const claimCost = takeover ? state.rules.takeoverCost : state.rules.fieldClaimCost;
  const fieldWasOwned = field.ownerId && field.ownerId !== userId;

  const nextUsers = state.users.map((item) => {
    if (item.id === userId) {
      return {
        ...item,
        underlings: Math.max(0, item.underlings - claimCost),
        seasonVictoryPoints: item.seasonVictoryPoints + 1,
        totalVictoryPoints: item.totalVictoryPoints + 1,
      };
    }
    if (fieldWasOwned && item.id === field.ownerId) {
      return {
        ...item,
        seasonVictoryPoints: Math.max(0, item.seasonVictoryPoints - 1),
        totalVictoryPoints: Math.max(0, item.totalVictoryPoints - 1),
      };
    }
    return item;
  });

  const nextFields = state.fields.map((item): Field => {
    if (item.id !== fieldId) return item;
    return {
      ...item,
      ownerId: userId,
      status: 'owned',
      siegeStatus: 'secured',
    };
  });

  return recalculateRanks({
    ...state,
    users: nextUsers,
    fields: nextFields,
  });
}

export function collectProduction(state: GameState, userId: string): GameState {
  const currentSeason = getCurrentSeason(state);
  const user = getUser(state, userId);
  if (!user) return state;

  let goldGain = 0;
  let materialGain = 0;

  const nextFields = state.fields.map((field) => {
    if (field.ownerId !== userId) return field;
    if (field.lastCollectedSeasonId === currentSeason.id) return field;
    if (field.productionType === 'gold') goldGain += field.productionValue;
    else materialGain += field.productionValue;
    return { ...field, lastCollectedSeasonId: currentSeason.id };
  });

  const nextUsers = state.users.map((item) => {
    if (item.id !== userId) return item;
    return {
      ...item,
      gold: item.gold + goldGain,
      buildingMaterial: item.buildingMaterial + materialGain,
    };
  });

  return {
    ...state,
    users: nextUsers,
    fields: nextFields,
  };
}

export function redeemReward(state: GameState, userId: string, rewardId: string): GameState {
  const user = getUser(state, userId);
  const reward = state.rewards.find((item) => item.id === rewardId);
  if (!user || !reward || !reward.active) return state;
  if (reward.redeemedBy.includes(userId)) return state;
  if (user.gold < reward.costInGold) return state;

  const nextUsers = state.users.map((item) => {
    if (item.id !== userId) return item;
    return { ...item, gold: item.gold - reward.costInGold };
  });

  const nextRewards = state.rewards.map((item) => {
    if (item.id !== rewardId) return item;
    return { ...item, redeemedBy: [...item.redeemedBy, userId] };
  });

  return {
    ...state,
    users: nextUsers,
    rewards: nextRewards,
  };
}

export function updateUserValue(state: GameState, userId: string, patch: Partial<User>): GameState {
  return { ...state, users: state.users.map((item) => (item.id === userId ? { ...item, ...patch } : item)) };
}

export function updateTask(state: GameState, taskId: string, patch: Partial<Task>): GameState {
  return { ...state, tasks: state.tasks.map((item) => (item.id === taskId ? { ...item, ...patch } : item)) };
}

export function updateField(state: GameState, fieldId: string, patch: Partial<Field>): GameState {
  return { ...state, fields: state.fields.map((item) => (item.id === fieldId ? { ...item, ...patch } : item)) };
}

export function updateReward(state: GameState, rewardId: string, patch: Partial<Reward>): GameState {
  return { ...state, rewards: state.rewards.map((item) => (item.id === rewardId ? { ...item, ...patch } : item)) };
}

export function startNewSeason(state: GameState): GameState {
  const currentSeason = getCurrentSeason(state);
  const now = new Date();
  const nextSeasonNumber = state.seasons.length + 1;
  const nextSeasonId = `season_${state.nextIds.season ?? nextSeasonNumber}`;
  const nextMapId = `map_${state.nextIds.map ?? nextSeasonNumber}`;

  const archivedMaps = {
    ...state.archivedMaps,
    [currentSeason.id]: state.fields,
  };

  const nextFields = state.fields.map((field) => ({
    ...field,
    ownerId: null,
    status: 'free' as const,
    siegeStatus: 'none' as const,
    lastCollectedSeasonId: null,
  }));

  const nextSeason = {
    id: nextSeasonId,
    name: `Saison ${nextSeasonNumber}`,
    startDate: now.toISOString(),
    endDate: addMonths(now, 2).toISOString(),
    activeMapId: nextMapId,
    active: true,
    archived: false,
  };

  return recalculateRanks({
    ...state,
    users: state.users.map((user) => ({ ...user, seasonVictoryPoints: 0 })),
    fields: nextFields,
    seasons: state.seasons.map((season) => ({ ...season, active: false, archived: true })).concat(nextSeason),
    archivedMaps,
    activeSeasonId: nextSeasonId,
    nextIds: {
      ...state.nextIds,
      season: (state.nextIds.season ?? 1) + 1,
      map: (state.nextIds.map ?? 1) + 1,
    },
  });
}

export function resetMapOnly(state: GameState): GameState {
  return {
    ...state,
    fields: state.fields.map((field) => ({
      ...field,
      ownerId: null,
      status: 'free' as const,
      siegeStatus: 'none' as const,
      lastCollectedSeasonId: null,
    })),
  };
}

export function createUserId(state: GameState) {
  const next = state.nextIds.user ?? 1;
  return `user_${next}`;
}
