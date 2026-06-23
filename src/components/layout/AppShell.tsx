import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { PERMISSIONS } from '../../lib/permissions';

const NAV_ITEMS = [
  { path: '/app', label: 'Dashboard', icon: '📊', permission: null },
  { path: '/app/tasks', label: 'Aufgaben', icon: '✅', permission: PERMISSIONS.VIEW_OWN_TASKS },
  { path: '/app/map', label: 'Reichskarte', icon: '🗺️', permission: PERMISSIONS.VIEW_MAP },
  { path: '/app/rewards', label: 'Belohnungen', icon: '🎁', permission: PERMISSIONS.BUY_REWARDS },
  { path: '/app/leaderboard', label: 'Rangliste', icon: '🏆', permission: PERMISSIONS.VIEW_LEADERBOARD },
  { path: '/app/admin', label: 'Admin', icon: '⚙️', permission: PERMISSIONS.ACCESS_ADMIN },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { member, family, hasPermission, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!member || !family) return null;

  const visibleNav = NAV_ITEMS.filter(
    (item) => item.permission === null || hasPermission(item.permission)
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand">{family.name}</span>
          <span className="topbar-member muted small">{member.avatar} {member.name}</span>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            Menü
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { signOut(); navigate('/'); }}>
            Abmelden
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-profile">
            <div className="avatar-lg">{member.avatar}</div>
            <div>
              <strong>{member.name}</strong>
              <div className="muted small">{member.role === 'admin' ? 'Administrator' : member.role === 'parent' ? 'Elternteil' : 'Spieler'}</div>
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
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
