import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { PERMISSIONS, isPlayingMember, type Permission } from '../../lib/permissions';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  // Shown when the member has any of these permissions; null means always.
  anyOf: Permission[] | null;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/app', label: 'Dashboard', icon: '📊', anyOf: null },
  { path: '/app/tasks', label: 'Aufgaben', icon: '✅', anyOf: [PERMISSIONS.VIEW_OWN_TASKS, PERMISSIONS.CREATE_TASKS, PERMISSIONS.APPROVE_TASKS] },
  { path: '/app/rewards', label: 'Belohnungen', icon: '🎁', anyOf: [PERMISSIONS.BUY_REWARDS, PERMISSIONS.CREATE_REWARDS] },
  { path: '/app/seasons', label: 'Saisons', icon: '📅', anyOf: null },
  { path: '/app/map', label: 'Reichskarte', icon: '🗺️', anyOf: [PERMISSIONS.VIEW_MAP] },
  { path: '/app/leaderboard', label: 'Rangliste', icon: '🏆', anyOf: [PERMISSIONS.VIEW_LEADERBOARD] },
  { path: '/app/admin', label: 'Admin', icon: '⚙️', anyOf: [PERMISSIONS.ACCESS_ADMIN] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { member, family, hasPermission, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!member || !family) return null;

  const isPlaying = isPlayingMember(member.role);
  const visibleNav = NAV_ITEMS.filter(
    (item) => item.anyOf === null || item.anyOf.some((p) => hasPermission(p))
  );

  const roleLabel = member.role === 'admin' ? 'Administrator' : member.role === 'parent' ? 'Elternteil' : 'Spieler';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="btn btn-ghost btn-sm topbar-menu"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Menü"
            aria-expanded={mobileNavOpen}
          >
            ☰
          </button>
          <span className="brand">{family.name}</span>
          <span className="topbar-member muted small">{member.avatar} {member.name}</span>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => { signOut(); navigate('/'); }}>
            Abmelden
          </button>
        </div>
      </header>

      <div className="app-layout">
        {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}
        <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-profile">
            <div className="avatar-lg">{member.avatar}</div>
            <div>
              <strong>{member.name}</strong>
              <div className="muted small">{roleLabel}</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {visibleNav.map((item) => (
              <button
                key={item.path}
                className={`nav-item ${location.pathname === item.path || (item.path !== '/app' && location.pathname.startsWith(item.path)) ? 'active' : ''}`}
                onClick={() => { navigate(item.path); setMobileNavOpen(false); }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {isPlaying ? (
            <div className="sidebar-stats">
              <div className="sidebar-stat">
                <span className="muted">Untertanen</span>
                <strong>{member.underlings}</strong>
              </div>
              <div className="sidebar-stat">
                <span className="muted">Gold</span>
                <strong>{member.gold}</strong>
              </div>
              <div className="sidebar-stat">
                <span className="muted">Baumaterial</span>
                <strong>{member.building_material}</strong>
              </div>
            </div>
          ) : (
            <div className="sidebar-stats sidebar-stats-admin">
              <div className="sidebar-stat sidebar-stat-wide">
                <span className="muted">Rolle</span>
                <strong>Verwaltung</strong>
              </div>
            </div>
          )}
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
