import { useEffect, useMemo, useState } from 'react';
import { createInitialState } from './lib/seed';
import { loadActiveUserId, loadState, saveActiveUserId, saveState, resetPersistedState } from './lib/storage';
import {
  approveTaskCompletion,
  canClaimField,
  canTakeOverField,
  claimField,
  collectProduction,
  completeTask,
  createUserId,
  getCurrentSeason,
  getOwnedFields,
  getUser,
  redeemReward,
  recalculateRanks,
  resetMapOnly,
  startNewSeason,
  updateField,
  updateReward,
  updateTask,
  updateUserValue,
} from './lib/game';
import type { Field, GameState, Reward, Role, Task, User } from './lib/types';
import { formatDate } from './lib/utils';

type Tab = 'dashboard' | 'tasks' | 'map' | 'resources' | 'rewards' | 'leaderboard' | 'admin';

function badgeForRole(role: Role) {
  if (role === 'admin') return 'Admin';
  if (role === 'parent') return 'Eltern';
  return 'Spieler';
}

function roleLabel(role: Role) {
  if (role === 'admin') return 'Voller Zugriff';
  if (role === 'parent') return 'Verwaltung + Bestätigung';
  return 'Spielerrolle';
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="muted small">{hint}</div> : null}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'danger' }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button className={`button ${variant}`} onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  );
}

function Input({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field-input">
      <span>{label}</span>
      {children}
    </label>
  );
}

function UserCard({
  user,
  selected,
  onSelect,
}: {
  user: User;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`user-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="user-avatar">{user.avatar ?? '🧭'}</div>
      <div className="user-meta">
        <div className="user-name-row">
          <strong>{user.name}</strong>
          <Pill tone={user.role === 'admin' ? 'good' : user.role === 'parent' ? 'warn' : 'neutral'}>{badgeForRole(user.role)}</Pill>
        </div>
        <div className="muted small">{roleLabel(user.role)}</div>
      </div>
    </button>
  );
}

function FieldTile({
  field,
  selected,
  claimable,
  takeoverable,
  ownedByCurrent,
  onSelect,
}: {
  field: Field;
  selected: boolean;
  claimable: boolean;
  takeoverable: boolean;
  ownedByCurrent: boolean;
  onSelect: () => void;
}) {
  const ownerTone = field.status === 'free' ? 'neutral' : field.status === 'contested' ? 'warn' : 'good';
  return (
    <button className={`field-tile ${selected ? 'selected' : ''} ${claimable ? 'claimable' : ''} ${takeoverable ? 'takeover' : ''}`} onClick={onSelect}>
      <div className="field-top">
        <strong>{field.name}</strong>
        <Pill tone={ownerTone}>{field.status}</Pill>
      </div>
      <div className="muted small">{field.type}</div>
      <div className="field-bottom">
        <span>{field.productionType === 'gold' ? 'Gold' : 'Baumaterial'} +{field.productionValue}</span>
        <span>{ownedByCurrent ? 'Deins' : field.ownerId ? 'Besetzt' : 'Frei'}</span>
      </div>
    </button>
  );
}

function App() {
  const [state, setState] = useState<GameState>(() => loadState(createInitialState()));
  const [activeUserId, setActiveUserId] = useState<string | null>(() => loadActiveUserId());
  const [tab, setTab] = useState<Tab>('dashboard');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(state.fields[0]?.id ?? null);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (activeUserId) saveActiveUserId(activeUserId);
  }, [activeUserId]);

  const activeUser = getUser(state, activeUserId);
  const currentSeason = getCurrentSeason(state);

  const rankedUsers = useMemo(() => {
    const sorted = [...state.users].sort((a, b) => {
      if (b.seasonVictoryPoints !== a.seasonVictoryPoints) return b.seasonVictoryPoints - a.seasonVictoryPoints;
      if (b.totalVictoryPoints !== a.totalVictoryPoints) return b.totalVictoryPoints - a.totalVictoryPoints;
      return a.name.localeCompare(b.name);
    });
    return sorted.map((user, index) => ({ ...user, rank: index + 1 }));
  }, [state.users]);

  useEffect(() => {
    if (!selectedFieldId && state.fields.length) setSelectedFieldId(state.fields[0].id);
  }, [selectedFieldId, state.fields]);

  useEffect(() => {
    if (activeUser && activeUser.role !== 'admin' && tab === 'admin') {
      setTab('dashboard');
    }
  }, [activeUser, tab]);

  function notify(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2500);
  }

  function updateState(next: GameState | ((prev: GameState) => GameState)) {
    setState((prev) => {
      const computed = typeof next === 'function' ? next(prev) : next;
      return recalculateRanks(computed);
    });
  }

  function selectUser(userId: string) {
    setActiveUserId(userId);
    setSelectedFieldId(state.fields[0]?.id ?? null);
    setTab('dashboard');
    notify('Profil ausgewählt');
  }

  function activeGuard(callback: (user: User) => void) {
    if (!activeUser) {
      notify('Bitte zuerst einen Nutzer wählen.');
      return;
    }
    callback(activeUser);
  }

  function handleTaskComplete(taskId: string) {
    activeGuard((user) => {
      updateState((prev) => completeTask(prev, taskId, user.id));
      notify('Aufgabe abgehakt');
    });
  }

  function handleTaskApprove(taskId: string, userId: string) {
    activeGuard((user) => {
      updateState((prev) => approveTaskCompletion(prev, taskId, userId, user.id));
      notify('Bestätigung gespeichert');
    });
  }

  function handleClaimField(fieldId: string, takeover = false) {
    activeGuard((user) => {
      updateState((prev) => claimField(prev, user.id, fieldId, takeover));
      notify(takeover ? 'Feld übernommen' : 'Feld erobert');
    });
  }

  function handleCollect() {
    activeGuard((user) => {
      updateState((prev) => collectProduction(prev, user.id));
      notify('Ertrag eingesammelt');
    });
  }

  function handleRedeem(rewardId: string) {
    activeGuard((user) => {
      updateState((prev) => redeemReward(prev, user.id, rewardId));
      notify('Belohnung eingelöst');
    });
  }

  function handleResetAll() {
    resetPersistedState();
    const fresh = createInitialState();
    setState(fresh);
    setActiveUserId(null);
    setTab('dashboard');
    setSelectedFieldId(fresh.fields[0]?.id ?? null);
    notify('Demo-Daten zurückgesetzt');
  }

  function handleStartSeason() {
    updateState((prev) => startNewSeason(prev));
    notify('Neue Saison gestartet');
  }

  function handleResetMap() {
    updateState((prev) => resetMapOnly(prev));
    notify('Map zurückgesetzt');
  }

  const visibleTasks = state.tasks.filter((task) => {
    if (!activeUser) return false;
    if (task.type === 'open') return true;
    return task.assignedTo === activeUser.id || activeUser.role !== 'player';
  });

  const privateTasks = visibleTasks.filter((task) => task.type === 'private');
  const openTasks = visibleTasks.filter((task) => task.type === 'open');

  const selectedField = state.fields.find((field) => field.id === selectedFieldId) ?? state.fields[0];
  const selectedFieldClaimable = activeUser ? canClaimField(state, activeUser.id, selectedField ?? state.fields[0]) : false;
  const selectedFieldTakeoverable = activeUser ? canTakeOverField(state, activeUser.id, selectedField ?? state.fields[0]) : false;
  const selectedFieldOwnedByCurrent = !!activeUser && selectedField?.ownerId === activeUser.id;

  const ownedFields = activeUser ? getOwnedFields(state, activeUser.id) : [];
  const currentRank = activeUser ? rankedUsers.find((user) => user.id === activeUser.id)?.rank ?? rankedUsers.length : rankedUsers.length;

  const taskCompletionSummary = useMemo(() => {
    const pending = state.tasks.reduce((count, task) => count + task.completions.filter((entry) => !entry.approved).length, 0);
    const done = state.tasks.reduce((count, task) => count + task.completions.filter((entry) => entry.approved).length, 0);
    return { pending, done };
  }, [state.tasks]);

  const mapRows = useMemo(() => {
    const sorted = [...state.fields].sort((a, b) => a.id.localeCompare(b.id));
    return [sorted.slice(0, 4), sorted.slice(4, 8), sorted.slice(8, 12)];
  }, [state.fields]);

  if (!activeUser) {
    return (
      <div className="app-shell login-shell">
        <div className="hero">
          <div className="hero-badge">Familien-Spielsystem</div>
          <h1>Haushalt als Reich aufbauen</h1>
          <p className="muted">
            Aufgaben bringen Untertanen. Untertanen erobern Felder. Felder bringen Ertrag. Gold wird gegen Belohnungen eingetauscht.
          </p>
        </div>

        <Section title="Nutzer wählen" subtitle="Admin, Eltern und Spieler starten hier mit ihrem Profil.">
          <div className="user-grid">
            {state.users.filter((user) => user.active).map((user) => (
              <UserCard key={user.id} user={user} selected={false} onSelect={() => selectUser(user.id)} />
            ))}
          </div>
        </Section>

        <Section title="Spielidee in kurz">
          <div className="info-grid">
            <div className="card info-card"><strong>Untertanen</strong><p>Entstehen nur durch erledigte Aufgaben.</p></div>
            <div className="card info-card"><strong>Felder</strong><p>Nur angrenzende Felder können eingenommen werden.</p></div>
            <div className="card info-card"><strong>Rangliste</strong><p>Die Gesamtwertung bleibt über Saisons erhalten.</p></div>
            <div className="card info-card"><strong>Belohnungen</strong><p>Gold wird im Shop gegen Familienvorteile getauscht.</p></div>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">Familien-Reich</div>
          <div className="muted small">Saison {currentSeason.name} · endet am {formatDate(currentSeason.endDate)}</div>
        </div>

        <div className="topbar-actions">
          <select
            className="select"
            value={activeUser.id}
            onChange={(e) => selectUser(e.target.value)}
            aria-label="Nutzer wählen"
          >
            {state.users.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name} · {badgeForRole(user.role)}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => setTab('dashboard')}>Dashboard</Button>
          <Button variant="ghost" onClick={handleCollect}>Ertrag</Button>
        </div>
      </header>

      <main className="content">
        <aside className="side-panel">
          <div className="card profile-card">
            <div className="profile-head">
              <div className="user-avatar large">{activeUser.avatar ?? '🧭'}</div>
              <div>
                <h2>{activeUser.name}</h2>
                <div className="muted small">{badgeForRole(activeUser.role)} · Rang {currentRank}</div>
              </div>
            </div>
            <div className="profile-stats">
              <div><span>Untertanen</span><strong>{activeUser.underlings}</strong></div>
              <div><span>Gold</span><strong>{activeUser.gold}</strong></div>
              <div><span>Baumaterial</span><strong>{activeUser.buildingMaterial}</strong></div>
              <div><span>Siegpunkte</span><strong>{activeUser.seasonVictoryPoints}</strong></div>
            </div>
          </div>

          <nav className="nav-grid">
            {(['dashboard', 'tasks', 'map', 'resources', 'rewards', 'leaderboard'] as Tab[]).map((item) => (
              <button key={item} className={`nav-item ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>
                {item === 'dashboard' && 'Dashboard'}
                {item === 'tasks' && 'Aufgaben'}
                {item === 'map' && 'Reichskarte'}
                {item === 'resources' && 'Ressourcen'}
                {item === 'rewards' && 'Belohnungen'}
                {item === 'leaderboard' && 'Rangliste'}
              </button>
            ))}
            {activeUser.role === 'admin' ? (
              <button className={`nav-item ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}>
                Admin
              </button>
            ) : null}
          </nav>

          {message ? <div className="toast">{message}</div> : null}
        </aside>

        <div className="main-panel">
          {tab === 'dashboard' ? (
            <>
              <Section title="Dashboard" subtitle="Die wichtigsten Werte auf einen Blick.">
                <div className="stat-grid">
                  <StatCard label="Untertanen" value={activeUser.underlings} hint="Entstehen nur über Aufgaben." />
                  <StatCard label="Gold" value={activeUser.gold} hint="Währung für Belohnungen." />
                  <StatCard label="Baumaterial" value={activeUser.buildingMaterial} hint="Ressource für Ausbau." />
                  <StatCard label="Aktuelle Siegpunkte" value={activeUser.seasonVictoryPoints} hint={`Rang ${currentRank} in der Saison.`} />
                  <StatCard label="Gesamt-Siegpunkte" value={activeUser.totalVictoryPoints} hint="Bleiben über Saisons erhalten." />
                  <StatCard label="Offene Aufgaben" value={visibleTasks.filter((task) => task.status === 'open').length} hint="Privat und offen." />
                </div>
              </Section>

              <div className="two-col">
                <Section title="Spielstatus" subtitle="Kompakter Überblick über den laufenden Reichsausbau.">
                  <div className="card stack-card">
                    <div className="stack-line"><span>Saison</span><strong>{currentSeason.name}</strong></div>
                    <div className="stack-line"><span>Map</span><strong>{currentSeason.activeMapId}</strong></div>
                    <div className="stack-line"><span>Eigene Felder</span><strong>{ownedFields.length}</strong></div>
                    <div className="stack-line"><span>Gesamt-Rang</span><strong>{currentRank}</strong></div>
                    <div className="stack-line"><span>Aufgaben bestätigt</span><strong>{taskCompletionSummary.done}</strong></div>
                  </div>
                </Section>

                <Section title="Aktuelle Aufgaben">
                  <div className="stack-list">
                    {visibleTasks.slice(0, 4).map((task) => (
                      <div className="card mini-task" key={task.id}>
                        <div className="mini-task-head">
                          <strong>{task.title}</strong>
                          <Pill tone={task.status === 'pending' ? 'warn' : task.status === 'done' ? 'good' : 'neutral'}>{task.status}</Pill>
                        </div>
                        <div className="muted small">{task.category} · {task.valueInUnderlings} Untertanen</div>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            </>
          ) : null}

          {tab === 'tasks' ? (
            <>
              <Section title="Aufgaben" subtitle="Private Aufgaben sind nur für die zugewiesene Person sichtbar. Offene Aufgaben können mehrere Spieler erledigen.">
                <div className="two-col">
                  <div>
                    <h3>Private Aufgaben</h3>
                    <div className="stack-list">
                      {privateTasks.length ? privateTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          currentUser={activeUser}
                          onComplete={() => handleTaskComplete(task.id)}
                          onApprove={(userId) => handleTaskApprove(task.id, userId)}
                        />
                      )) : <div className="muted">Keine privaten Aufgaben sichtbar.</div>}
                    </div>
                  </div>

                  <div>
                    <h3>Offene Aufgaben</h3>
                    <div className="stack-list">
                      {openTasks.length ? openTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          currentUser={activeUser}
                          onComplete={() => handleTaskComplete(task.id)}
                          onApprove={(userId) => handleTaskApprove(task.id, userId)}
                        />
                      )) : <div className="muted">Keine offenen Aufgaben sichtbar.</div>}
                    </div>
                  </div>
                </div>
              </Section>
            </>
          ) : null}

          {tab === 'map' ? (
            <>
              <Section title="Reichskarte" subtitle="Nur angrenzende Felder können eingenommen werden. Ein Feld bringt immer 1 Siegpunkt.">
                <div className="map-layout">
                  <div className="map-grid">
                    {mapRows.flat().map((field) => {
                      const claimable = activeUser ? canClaimField(state, activeUser.id, field) : false;
                      const takeoverable = activeUser ? canTakeOverField(state, activeUser.id, field) : false;
                      const ownedByCurrent = field.ownerId === activeUser.id;
                      return (
                        <FieldTile
                          key={field.id}
                          field={field}
                          selected={selectedField?.id === field.id}
                          claimable={claimable}
                          takeoverable={takeoverable}
                          ownedByCurrent={ownedByCurrent}
                          onSelect={() => setSelectedFieldId(field.id)}
                        />
                      );
                    })}
                  </div>

                  <div className="card detail-card">
                    {selectedField ? (
                      <>
                        <div className="detail-head">
                          <div>
                            <h3>{selectedField.name}</h3>
                            <div className="muted small">{selectedField.type} · {selectedField.status}</div>
                          </div>
                          <Pill tone={selectedField.ownerId ? (selectedField.ownerId === activeUser.id ? 'good' : 'warn') : 'neutral'}>
                            {selectedField.ownerId ? 'besetzt' : 'frei'}
                          </Pill>
                        </div>
                        <div className="stack-line"><span>Produktion</span><strong>{selectedField.productionType === 'gold' ? 'Gold' : 'Baumaterial'} +{selectedField.productionValue}</strong></div>
                        <div className="stack-line"><span>Wert</span><strong>1 Siegpunkt</strong></div>
                        <div className="stack-line"><span>Sicherung</span><strong>{selectedField.siegeStatus}</strong></div>
                        <div className="stack-line"><span>Angrenzend</span><strong>{selectedField.adjacentFieldIds.join(', ')}</strong></div>

                        <div className="action-row">
                          <Button onClick={() => handleClaimField(selectedField.id)} disabled={!selectedFieldClaimable}>
                            Feld erobern
                          </Button>
                          <Button variant="secondary" onClick={() => handleClaimField(selectedField.id, true)} disabled={!selectedFieldTakeoverable}>
                            Feld übernehmen
                          </Button>
                        </div>

                        <div className="muted small">
                          {selectedField.ownerId === activeUser.id
                            ? 'Dieses Feld gehört dir.'
                            : selectedField.ownerId
                              ? 'Das Feld gehört einem anderen Spieler. Übernahme ist möglich, wenn es angrenzend ist und genug Untertanen vorhanden sind.'
                              : 'Freies Feld. Startfelder dürfen ohne angrenzenden Besitz gesetzt werden.'}
                        </div>
                      </>
                    ) : (
                      <div className="muted">Wähle ein Feld aus.</div>
                    )}
                  </div>
                </div>
              </Section>
            </>
          ) : null}

          {tab === 'resources' ? (
            <>
              <Section title="Ressourcen" subtitle="Gold ist die Belohnungswährung. Baumaterial ist für Ausbau und Reichsverbesserungen gedacht.">
                <div className="two-col">
                  <div className="card stack-card">
                    <div className="stack-line"><span>Gold</span><strong>{activeUser.gold}</strong></div>
                    <div className="stack-line"><span>Baumaterial</span><strong>{activeUser.buildingMaterial}</strong></div>
                    <div className="stack-line"><span>Untertanen</span><strong>{activeUser.underlings}</strong></div>
                  </div>
                  <div className="card stack-card">
                    <div className="stack-line"><span>Gold kommt aus</span><strong>eigenen Gold-Feldern</strong></div>
                    <div className="stack-line"><span>Baumaterial kommt aus</span><strong>Baumaterial-Feldern</strong></div>
                    <div className="stack-line"><span>Untertanen kommen aus</span><strong>erledigten Aufgaben</strong></div>
                  </div>
                </div>

                <div className="resource-grid">
                  {ownedFields.map((field) => (
                    <div key={field.id} className="card resource-card">
                      <strong>{field.name}</strong>
                      <div className="muted small">{field.productionType === 'gold' ? 'Gold' : 'Baumaterial'} +{field.productionValue}</div>
                      <div className="muted small">Letzter Ertrag: {field.lastCollectedSeasonId === currentSeason.id ? 'bereits eingesammelt' : 'offen'}</div>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          ) : null}

          {tab === 'rewards' ? (
            <>
              <Section title="Belohnungsshop" subtitle="Gold gegen Sonderrechte, Familienvorteile oder kosmetische Extras eintauschen.">
                <div className="reward-grid">
                  {state.rewards.filter((reward) => reward.active).map((reward) => {
                    const redeemed = reward.redeemedBy.includes(activeUser.id);
                    return (
                      <div className="card reward-card" key={reward.id}>
                        <div className="detail-head">
                          <div>
                            <h3>{reward.name}</h3>
                            <div className="muted small">{reward.description}</div>
                          </div>
                          <Pill tone={redeemed ? 'good' : 'neutral'}>{redeemed ? 'eingelöst' : `${reward.costInGold} Gold`}</Pill>
                        </div>
                        <div className="action-row">
                          <Button disabled={redeemed || activeUser.gold < reward.costInGold} onClick={() => handleRedeem(reward.id)}>
                            Einlösen
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </>
          ) : null}

          {tab === 'leaderboard' ? (
            <>
              <Section title="Rangliste" subtitle="Saisonwertung und Gesamtwertung über alle Saisons.">
                <div className="two-col">
                  <div>
                    <h3>Saison-Rangliste</h3>
                    <div className="stack-list">
                      {rankedUsers.map((user) => (
                        <div key={user.id} className={`card leaderboard-row ${user.id === activeUser.id ? 'highlight' : ''}`}>
                          <div className="leader-left">
                            <strong>#{user.rank} {user.name}</strong>
                            <div className="muted small">{badgeForRole(user.role)}</div>
                          </div>
                          <div className="leader-right">
                            <span>{user.seasonVictoryPoints} SP</span>
                            <span>{user.totalVictoryPoints} gesamt</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card stack-card">
                    <h3>Gesamt-Rang</h3>
                    <div className="muted">Die Gesamtwertung bleibt erhalten, auch wenn eine neue Map startet.</div>
                    <div className="stack-list compact">
                      {rankedUsers.slice(0, 3).map((user) => (
                        <div className="stack-line" key={user.id}>
                          <span>#{user.rank} {user.name}</span>
                          <strong>{user.totalVictoryPoints}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>
            </>
          ) : null}

          {tab === 'admin' && activeUser.role === 'admin' ? (
            <>
              <Section title="Admin-Bereich" subtitle="Voller Zugriff: Nutzer, Aufgaben, Felder, Belohnungen, Saisons und Regeln.">
                <div className="admin-actions">
                  <Button onClick={handleStartSeason}>Neue Saison starten</Button>
                  <Button variant="secondary" onClick={handleResetMap}>Map zurücksetzen</Button>
                  <Button variant="danger" onClick={handleResetAll}>Demo-Daten zurücksetzen</Button>
                </div>
              </Section>

              <AdminUsers state={state} setState={updateState} />
              <AdminTasks state={state} setState={updateState} activeUserId={activeUser.id} />
              <AdminFields state={state} setState={updateState} />
              <AdminRewards state={state} setState={updateState} />
              <AdminRules state={state} setState={updateState} />
              <AdminSeasons state={state} />
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function TaskCard({
  task,
  currentUser,
  onComplete,
  onApprove,
}: {
  task: Task;
  currentUser: User;
  onComplete: () => void;
  onApprove: (userId: string) => void;
}) {
  const canComplete = task.type === 'open' || task.assignedTo === currentUser.id || currentUser.role !== 'player';
  const pendingCompletions = task.completions.filter((entry) => !entry.approved);
  const approvedCompletions = task.completions.filter((entry) => entry.approved);

  return (
    <div className="card task-card">
      <div className="detail-head">
        <div>
          <h3>{task.title}</h3>
          <div className="muted small">{task.category} · {task.type === 'private' ? 'privat' : 'offen'}</div>
        </div>
        <Pill tone={task.status === 'pending' ? 'warn' : task.status === 'done' ? 'good' : 'neutral'}>{task.status}</Pill>
      </div>
      <p>{task.description}</p>
      <div className="task-meta">
        <span>{task.valueInUnderlings} Untertanen</span>
        <span>{task.needsApproval ? 'Bestätigung nötig' : 'keine Bestätigung'}</span>
        <span>{task.repeatable ? 'wiederholend' : 'einmalig'}</span>
      </div>
      <div className="action-row">
        <Button onClick={onComplete} disabled={!canComplete || task.status === 'pending'}>
          Abhaken
        </Button>
      </div>
      <div className="muted small">
        Erledigt: {approvedCompletions.length} · Wartend: {pendingCompletions.length}
      </div>
      {pendingCompletions.length > 0 && (currentUser.role === 'admin' || currentUser.role === 'parent') ? (
        <div className="approval-box">
          <div className="muted small">Wartende Bestätigungen</div>
          {pendingCompletions.map((entry) => (
            <div key={`${entry.userId}-${entry.completedAt}`} className="approval-row">
              <span>{entry.userId}</span>
              <Button variant="secondary" onClick={() => onApprove(entry.userId)}>
                Freigeben
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AdminUsers({ state, setState }: { state: GameState; setState: (next: GameState | ((prev: GameState) => GameState)) => void }) {
  const roles: Role[] = ['admin', 'parent', 'player'];

  function saveUser(userId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const patch = {
      name: String(data.get('name') ?? ''),
      role: String(data.get('role') ?? 'player') as Role,
      active: data.get('active') === 'on',
      avatar: String(data.get('avatar') ?? ''),
      gold: Number(data.get('gold') ?? 0),
      buildingMaterial: Number(data.get('buildingMaterial') ?? 0),
      underlings: Number(data.get('underlings') ?? 0),
      totalVictoryPoints: Number(data.get('totalVictoryPoints') ?? 0),
      seasonVictoryPoints: Number(data.get('seasonVictoryPoints') ?? 0),
    };
    setState((prev) => updateUserValue(prev, userId, patch));
  }

  function addUser(form: HTMLFormElement) {
    const data = new FormData(form);
    const tempId = createUserId(state);
    const nextUser = {
      id: tempId,
      name: String(data.get('name') ?? 'Neuer Nutzer'),
      role: String(data.get('role') ?? 'player') as Role,
      active: true,
      avatar: String(data.get('avatar') ?? '🙂') || '🙂',
      gold: Number(data.get('gold') ?? 0),
      buildingMaterial: Number(data.get('buildingMaterial') ?? 0),
      underlings: Number(data.get('underlings') ?? 0),
      totalVictoryPoints: Number(data.get('totalVictoryPoints') ?? 0),
      seasonVictoryPoints: Number(data.get('seasonVictoryPoints') ?? 0),
    };
    setState((prev) => ({
      ...prev,
      users: [...prev.users, nextUser],
      nextIds: { ...prev.nextIds, user: (prev.nextIds.user ?? 1) + 1 },
    }));
    form.reset();
  }

  return (
    <Section title="Nutzerverwaltung" subtitle="Spieler anlegen, bearbeiten, löschen und Rollen wechseln.">
      <form className="card admin-create" onSubmit={(e) => { e.preventDefault(); addUser(e.currentTarget); }}>
        <div className="form-grid">
          <Input label="Name"><input name="name" defaultValue="Neuer Nutzer" /></Input>
          <Input label="Rolle">
            <select name="role" defaultValue="player">
              {roles.map((role) => <option key={role} value={role}>{badgeForRole(role)}</option>)}
            </select>
          </Input>
          <Input label="Avatar"><input name="avatar" defaultValue="🙂" /></Input>
          <Input label="Gold"><input name="gold" type="number" defaultValue={0} /></Input>
          <Input label="Baumaterial"><input name="buildingMaterial" type="number" defaultValue={0} /></Input>
          <Input label="Untertanen"><input name="underlings" type="number" defaultValue={0} /></Input>
          <Input label="Gesamt-SP"><input name="totalVictoryPoints" type="number" defaultValue={0} /></Input>
          <Input label="Saison-SP"><input name="seasonVictoryPoints" type="number" defaultValue={0} /></Input>
        </div>
        <Button type="submit">Nutzer anlegen</Button>
      </form>

      <div className="stack-list">
        {state.users.map((user) => (
          <form
            key={user.id}
            className="card admin-row"
            onSubmit={(e) => {
              e.preventDefault();
              saveUser(user.id, e.currentTarget);
            }}
          >
            <div className="form-grid admin-grid">
              <Input label="Name"><input name="name" defaultValue={user.name} /></Input>
              <Input label="Rolle">
                <select name="role" defaultValue={user.role}>
                  {roles.map((role) => <option key={role} value={role}>{badgeForRole(role)}</option>)}
                </select>
              </Input>
              <Input label="Avatar"><input name="avatar" defaultValue={user.avatar ?? ''} /></Input>
              <Input label="Aktiv"><input name="active" type="checkbox" defaultChecked={user.active} /></Input>
              <Input label="Gold"><input name="gold" type="number" defaultValue={user.gold} /></Input>
              <Input label="Baumaterial"><input name="buildingMaterial" type="number" defaultValue={user.buildingMaterial} /></Input>
              <Input label="Untertanen"><input name="underlings" type="number" defaultValue={user.underlings} /></Input>
              <Input label="Gesamt-SP"><input name="totalVictoryPoints" type="number" defaultValue={user.totalVictoryPoints} /></Input>
              <Input label="Saison-SP"><input name="seasonVictoryPoints" type="number" defaultValue={user.seasonVictoryPoints} /></Input>
            </div>
            <div className="action-row">
              <Button type="submit">Speichern</Button>
              <Button
                variant="danger"
                onClick={() => {
                  setState((prev) => ({ ...prev, users: prev.users.filter((item) => item.id !== user.id) }));
                }}
              >
                Löschen
              </Button>
            </div>
          </form>
        ))}
      </div>
    </Section>
  );
}

function AdminTasks({ state, setState, activeUserId }: { state: GameState; setState: (next: GameState | ((prev: GameState) => GameState)) => void; activeUserId: string }) {
  function saveTask(taskId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    setState((prev) => updateTask(prev, taskId, {
      title: String(data.get('title') ?? ''),
      description: String(data.get('description') ?? ''),
      type: String(data.get('type') ?? 'open') as 'private' | 'open',
      assignedTo: String(data.get('assignedTo') ?? '') || null,
      valueInUnderlings: Number(data.get('valueInUnderlings') ?? 0),
      needsApproval: data.get('needsApproval') === 'on',
      repeatable: data.get('repeatable') === 'on',
      status: String(data.get('status') ?? 'open') as Task['status'],
      category: String(data.get('category') ?? ''),
      createdBy: activeUserId,
    }));
  }

  function addTask(form: HTMLFormElement) {
    const data = new FormData(form);
    const id = `task_${state.nextIds.task ?? 1}`;
    const task: Task = {
      id,
      title: String(data.get('title') ?? 'Neue Aufgabe'),
      description: String(data.get('description') ?? ''),
      type: String(data.get('type') ?? 'open') as 'private' | 'open',
      assignedTo: String(data.get('assignedTo') ?? '') || null,
      valueInUnderlings: Number(data.get('valueInUnderlings') ?? 0),
      needsApproval: data.get('needsApproval') === 'on',
      repeatable: data.get('repeatable') === 'on',
      status: 'open',
      category: String(data.get('category') ?? 'Allgemein'),
      createdBy: activeUserId,
      completions: [],
    };
    setState((prev) => ({
      ...prev,
      tasks: [...prev.tasks, task],
      nextIds: { ...prev.nextIds, task: (prev.nextIds.task ?? 1) + 1 },
    }));
    form.reset();
  }

  return (
    <Section title="Aufgabenverwaltung" subtitle="Private und offene Aufgaben anlegen und bearbeiten.">
      <form className="card admin-create" onSubmit={(e) => { e.preventDefault(); addTask(e.currentTarget); }}>
        <div className="form-grid">
          <Input label="Titel"><input name="title" defaultValue="Neue Aufgabe" /></Input>
          <Input label="Kategorie"><input name="category" defaultValue="Allgemein" /></Input>
          <Input label="Typ">
            <select name="type" defaultValue="open">
              <option value="open">offen</option>
              <option value="private">privat</option>
            </select>
          </Input>
          <Input label="Zugewiesen an">
            <select name="assignedTo" defaultValue="">
              <option value="">offen / niemand</option>
              {state.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </Input>
          <Input label="Wert Untertanen"><input name="valueInUnderlings" type="number" defaultValue={1} /></Input>
          <Input label="Status">
            <select name="status" defaultValue="open">
              <option value="open">offen</option>
              <option value="pending">pending</option>
              <option value="done">done</option>
            </select>
          </Input>
          <Input label="Bestätigung"><input name="needsApproval" type="checkbox" /></Input>
          <Input label="Wiederholend"><input name="repeatable" type="checkbox" defaultChecked /></Input>
        </div>
        <Input label="Beschreibung"><textarea name="description" rows={3} defaultValue="Aufgabe beschreiben" /></Input>
        <Button type="submit">Aufgabe anlegen</Button>
      </form>

      <div className="stack-list">
        {state.tasks.map((task) => (
          <form
            key={task.id}
            className="card admin-row"
            onSubmit={(e) => {
              e.preventDefault();
              saveTask(task.id, e.currentTarget);
            }}
          >
            <div className="form-grid admin-grid">
              <Input label="Titel"><input name="title" defaultValue={task.title} /></Input>
              <Input label="Kategorie"><input name="category" defaultValue={task.category} /></Input>
              <Input label="Typ">
                <select name="type" defaultValue={task.type}>
                  <option value="open">offen</option>
                  <option value="private">privat</option>
                </select>
              </Input>
              <Input label="Zugewiesen an">
                <select name="assignedTo" defaultValue={task.assignedTo ?? ''}>
                  <option value="">offen / niemand</option>
                  {state.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </Input>
              <Input label="Untertanen"><input name="valueInUnderlings" type="number" defaultValue={task.valueInUnderlings} /></Input>
              <Input label="Status">
                <select name="status" defaultValue={task.status}>
                  <option value="open">offen</option>
                  <option value="pending">pending</option>
                  <option value="done">done</option>
                </select>
              </Input>
              <Input label="Bestätigung"><input name="needsApproval" type="checkbox" defaultChecked={task.needsApproval} /></Input>
              <Input label="Wiederholend"><input name="repeatable" type="checkbox" defaultChecked={task.repeatable} /></Input>
            </div>
            <Input label="Beschreibung"><textarea name="description" rows={3} defaultValue={task.description} /></Input>
            <div className="action-row">
              <Button type="submit">Speichern</Button>
              <Button variant="danger" onClick={() => setState((prev) => ({ ...prev, tasks: prev.tasks.filter((item) => item.id !== task.id) }))}>
                Löschen
              </Button>
            </div>
          </form>
        ))}
      </div>
    </Section>
  );
}

function AdminFields({ state, setState }: { state: GameState; setState: (next: GameState | ((prev: GameState) => GameState)) => void }) {
  function saveField(fieldId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    setState((prev) => updateField(prev, fieldId, {
      name: String(data.get('name') ?? ''),
      type: String(data.get('type') ?? ''),
      ownerId: String(data.get('ownerId') ?? '') || null,
      status: String(data.get('status') ?? 'free') as Field['status'],
      productionType: String(data.get('productionType') ?? 'gold') as Field['productionType'],
      productionValue: Number(data.get('productionValue') ?? 0),
      siegeStatus: String(data.get('siegeStatus') ?? 'none') as Field['siegeStatus'],
      adjacentFieldIds: String(data.get('adjacentFieldIds') ?? '').split(',').map((x) => x.trim()).filter(Boolean),
      lastCollectedSeasonId: String(data.get('lastCollectedSeasonId') ?? '') || null,
    }));
  }

  function addField(form: HTMLFormElement) {
    const data = new FormData(form);
    const id = uid('field', state.nextIds);
    const field: Field = {
      id,
      name: String(data.get('name') ?? `Feld ${id}`),
      type: String(data.get('type') ?? 'Bezirk'),
      ownerId: String(data.get('ownerId') ?? '') || null,
      adjacentFieldIds: String(data.get('adjacentFieldIds') ?? '').split(',').map((x) => x.trim()).filter(Boolean),
      status: String(data.get('status') ?? 'free') as Field['status'],
      productionType: String(data.get('productionType') ?? 'gold') as Field['productionType'],
      productionValue: Number(data.get('productionValue') ?? 0),
      siegeStatus: String(data.get('siegeStatus') ?? 'none') as Field['siegeStatus'],
      victoryPointValue: 1,
      lastCollectedSeasonId: null,
    };
    setState((prev) => ({
      ...prev,
      fields: [...prev.fields, field],
      nextIds: { ...prev.nextIds, field: (prev.nextIds.field ?? 1) + 1 },
    }));
    form.reset();
  }

  return (
    <Section title="Kartenverwaltung" subtitle="Felder, Besitz, angrenzende Felder und Status manuell anpassen.">
      <form className="card admin-create" onSubmit={(e) => { e.preventDefault(); addField(e.currentTarget); }}>
        <div className="form-grid">
          <Input label="Name"><input name="name" defaultValue="Neues Feld" /></Input>
          <Input label="Typ"><input name="type" defaultValue="Bezirk" /></Input>
          <Input label="Besitzer">
            <select name="ownerId" defaultValue="">
              <option value="">niemand</option>
              {state.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </Input>
          <Input label="Status">
            <select name="status" defaultValue="free">
              <option value="free">free</option>
              <option value="owned">owned</option>
              <option value="contested">contested</option>
              <option value="secured">secured</option>
            </select>
          </Input>
          <Input label="Ertragstyp">
            <select name="productionType" defaultValue="gold">
              <option value="gold">Gold</option>
              <option value="buildingMaterial">Baumaterial</option>
            </select>
          </Input>
          <Input label="Ertrag"><input name="productionValue" type="number" defaultValue={1} /></Input>
          <Input label="Sicherung">
            <select name="siegeStatus" defaultValue="none">
              <option value="none">none</option>
              <option value="sieged">sieged</option>
              <option value="secured">secured</option>
            </select>
          </Input>
          <Input label="Angrenzend (Komma)">
            <input name="adjacentFieldIds" defaultValue="A1,A2" />
          </Input>
        </div>
        <Button type="submit">Feld anlegen</Button>
      </form>

      <div className="stack-list">
        {state.fields.map((field) => (
          <form
            key={field.id}
            className="card admin-row"
            onSubmit={(e) => {
              e.preventDefault();
              saveField(field.id, e.currentTarget);
            }}
          >
            <div className="form-grid admin-grid">
              <Input label="Name"><input name="name" defaultValue={field.name} /></Input>
              <Input label="Typ"><input name="type" defaultValue={field.type} /></Input>
              <Input label="Besitzer">
                <select name="ownerId" defaultValue={field.ownerId ?? ''}>
                  <option value="">niemand</option>
                  {state.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </Input>
              <Input label="Status">
                <select name="status" defaultValue={field.status}>
                  <option value="free">free</option>
                  <option value="owned">owned</option>
                  <option value="contested">contested</option>
                  <option value="secured">secured</option>
                </select>
              </Input>
              <Input label="Ertragstyp">
                <select name="productionType" defaultValue={field.productionType}>
                  <option value="gold">Gold</option>
                  <option value="buildingMaterial">Baumaterial</option>
                </select>
              </Input>
              <Input label="Ertrag"><input name="productionValue" type="number" defaultValue={field.productionValue} /></Input>
              <Input label="Sicherung">
                <select name="siegeStatus" defaultValue={field.siegeStatus}>
                  <option value="none">none</option>
                  <option value="sieged">sieged</option>
                  <option value="secured">secured</option>
                </select>
              </Input>
              <Input label="Angrenzend"><input name="adjacentFieldIds" defaultValue={field.adjacentFieldIds.join(',')} /></Input>
            </div>
            <Input label="Letzter Ertrag (Saison-ID)"><input name="lastCollectedSeasonId" defaultValue={field.lastCollectedSeasonId ?? ''} /></Input>
            <div className="action-row">
              <Button type="submit">Speichern</Button>
              <Button variant="danger" onClick={() => setState((prev) => ({ ...prev, fields: prev.fields.filter((item) => item.id !== field.id) }))}>
                Löschen
              </Button>
            </div>
          </form>
        ))}
      </div>
    </Section>
  );
}

function AdminRewards({ state, setState }: { state: GameState; setState: (next: GameState | ((prev: GameState) => GameState)) => void }) {
  function saveReward(rewardId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    setState((prev) => updateReward(prev, rewardId, {
      name: String(data.get('name') ?? ''),
      description: String(data.get('description') ?? ''),
      costInGold: Number(data.get('costInGold') ?? 0),
      type: String(data.get('type') ?? 'special-right') as Reward['type'],
      active: data.get('active') === 'on',
      redeemedBy: String(data.get('redeemedBy') ?? '').split(',').map((x) => x.trim()).filter(Boolean),
    }));
  }

  function addReward(form: HTMLFormElement) {
    const data = new FormData(form);
    const id = `reward_${state.nextIds.reward ?? 1}`;
    const reward: Reward = {
      id,
      name: String(data.get('name') ?? 'Neue Belohnung'),
      description: String(data.get('description') ?? ''),
      costInGold: Number(data.get('costInGold') ?? 0),
      type: String(data.get('type') ?? 'special-right') as Reward['type'],
      active: true,
      redeemedBy: [],
    };
    setState((prev) => ({
      ...prev,
      rewards: [...prev.rewards, reward],
      nextIds: { ...prev.nextIds, reward: (prev.nextIds.reward ?? 1) + 1 },
    }));
    form.reset();
  }

  return (
    <Section title="Belohnungen" subtitle="Shop-Einträge anlegen und den Goldpreis anpassen.">
      <form className="card admin-create" onSubmit={(e) => { e.preventDefault(); addReward(e.currentTarget); }}>
        <div className="form-grid">
          <Input label="Name"><input name="name" defaultValue="Neue Belohnung" /></Input>
          <Input label="Kosten Gold"><input name="costInGold" type="number" defaultValue={10} /></Input>
          <Input label="Typ">
            <select name="type" defaultValue="special-right">
              <option value="special-right">special-right</option>
              <option value="cosmetic">cosmetic</option>
              <option value="family-benefit">family-benefit</option>
              <option value="game-boost">game-boost</option>
            </select>
          </Input>
        </div>
        <Input label="Beschreibung"><textarea name="description" rows={3} defaultValue="Beschreibung" /></Input>
        <Button type="submit">Belohnung anlegen</Button>
      </form>

      <div className="stack-list">
        {state.rewards.map((reward) => (
          <form
            key={reward.id}
            className="card admin-row"
            onSubmit={(e) => {
              e.preventDefault();
              saveReward(reward.id, e.currentTarget);
            }}
          >
            <div className="form-grid admin-grid">
              <Input label="Name"><input name="name" defaultValue={reward.name} /></Input>
              <Input label="Kosten Gold"><input name="costInGold" type="number" defaultValue={reward.costInGold} /></Input>
              <Input label="Typ">
                <select name="type" defaultValue={reward.type}>
                  <option value="special-right">special-right</option>
                  <option value="cosmetic">cosmetic</option>
                  <option value="family-benefit">family-benefit</option>
                  <option value="game-boost">game-boost</option>
                </select>
              </Input>
              <Input label="Aktiv"><input name="active" type="checkbox" defaultChecked={reward.active} /></Input>
            </div>
            <Input label="Beschreibung"><textarea name="description" rows={3} defaultValue={reward.description} /></Input>
            <Input label="Eingelöst von (IDs, Komma)">
              <input name="redeemedBy" defaultValue={reward.redeemedBy.join(',')} />
            </Input>
            <div className="action-row">
              <Button type="submit">Speichern</Button>
              <Button variant="danger" onClick={() => setState((prev) => ({ ...prev, rewards: prev.rewards.filter((item) => item.id !== reward.id) }))}>
                Löschen
              </Button>
            </div>
          </form>
        ))}
      </div>
    </Section>
  );
}

function AdminRules({ state, setState }: { state: GameState; setState: (next: GameState | ((prev: GameState) => GameState)) => void }) {
  function saveRules(form: HTMLFormElement) {
    const data = new FormData(form);
    setState((prev) => ({
      ...prev,
      rules: {
        underlingsPerTask: String(data.get('underlingsPerTask') ?? prev.rules.underlingsPerTask),
        fieldClaimCost: Number(data.get('fieldClaimCost') ?? prev.rules.fieldClaimCost),
        takeoverCost: Number(data.get('takeoverCost') ?? prev.rules.takeoverCost),
        seasonLengthMonths: Number(data.get('seasonLengthMonths') ?? prev.rules.seasonLengthMonths),
      },
    }));
  }

  return (
    <Section title="Regeln und Balancing" subtitle="Hier kann der Admin die grundlegenden Werte feinjustieren.">
      <form className="card admin-create" onSubmit={(e) => { e.preventDefault(); saveRules(e.currentTarget); }}>
        <div className="form-grid">
          <Input label="Hinweistext"><input name="underlingsPerTask" defaultValue={state.rules.underlingsPerTask} /></Input>
          <Input label="Feld erobern"><input name="fieldClaimCost" type="number" defaultValue={state.rules.fieldClaimCost} /></Input>
          <Input label="Feld übernehmen"><input name="takeoverCost" type="number" defaultValue={state.rules.takeoverCost} /></Input>
          <Input label="Saison in Monaten"><input name="seasonLengthMonths" type="number" defaultValue={state.rules.seasonLengthMonths} /></Input>
        </div>
        <Button type="submit">Regeln speichern</Button>
      </form>
    </Section>
  );
}

function AdminSeasons({ state }: { state: GameState }) {
  return (
    <Section title="Saisons" subtitle="Neue Saisons schaffen neue Maps. Alte Siegpunkte bleiben erhalten.">
      <div className="stack-list">
        {state.seasons.map((season) => (
          <div className="card stack-card" key={season.id}>
            <div className="stack-line"><span>{season.name}</span><strong>{season.active ? 'aktiv' : 'archiviert'}</strong></div>
            <div className="stack-line"><span>Start</span><strong>{formatDate(season.startDate)}</strong></div>
            <div className="stack-line"><span>Ende</span><strong>{formatDate(season.endDate)}</strong></div>
            <div className="stack-line"><span>Map</span><strong>{season.activeMapId}</strong></div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export default App;
