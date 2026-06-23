import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { PERMISSIONS } from '../../lib/permissions';
import { AdminOverview } from './AdminOverview';
import { AdminMembers } from './AdminMembers';
import { AdminTasks } from './AdminTasks';
import { AdminRewards } from './AdminRewards';
import { AdminSeasons } from './AdminSeasons';
import { AdminRules } from './AdminRules';

type AdminTab = 'overview' | 'members' | 'tasks' | 'rewards' | 'seasons' | 'rules';

const ADMIN_TABS: { key: AdminTab; label: string; permission: string | null }[] = [
  { key: 'overview', label: 'Übersicht', permission: null },
  { key: 'members', label: 'Mitglieder', permission: PERMISSIONS.MANAGE_MEMBERS },
  { key: 'tasks', label: 'Aufgaben', permission: PERMISSIONS.CREATE_TASKS },
  { key: 'rewards', label: 'Belohnungen', permission: PERMISSIONS.CREATE_REWARDS },
  { key: 'seasons', label: 'Saisons', permission: PERMISSIONS.MANAGE_SEASONS },
  { key: 'rules', label: 'Regeln', permission: PERMISSIONS.MANAGE_RULES },
];

export function AdminPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const visibleTabs = ADMIN_TABS.filter(
    (tab) => tab.permission === null || hasPermission(tab.permission as never)
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin-Bereich</h1>
        <p className="muted">Verwaltung der Familie, Aufgaben, Belohnungen und Einstellungen.</p>
      </div>

      <div className="admin-tabs">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            className={`admin-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {activeTab === 'overview' && <AdminOverview />}
        {activeTab === 'members' && <AdminMembers />}
        {activeTab === 'tasks' && <AdminTasks />}
        {activeTab === 'rewards' && <AdminRewards />}
        {activeTab === 'seasons' && <AdminSeasons />}
        {activeTab === 'rules' && <AdminRules />}
      </div>
    </div>
  );
}
