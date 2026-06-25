import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { PERMISSIONS } from '../../lib/permissions';
import { AdminOverview } from './AdminOverview';
import { AdminMembers } from './AdminMembers';
import { AdminRules } from './AdminRules';

type AdminTab = 'overview' | 'members' | 'rules';

const ADMIN_TABS: { key: AdminTab; label: string; permission: string | null }[] = [
  { key: 'overview', label: 'Übersicht', permission: null },
  { key: 'members', label: 'Familienverwaltung', permission: PERMISSIONS.MANAGE_MEMBERS },
  { key: 'rules', label: 'Regeln & Einstellungen', permission: PERMISSIONS.MANAGE_RULES },
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
        <p className="muted">Reine Verwaltung: Familienmitglieder, Regeln und Systemeinstellungen.</p>
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
        {activeTab === 'rules' && <AdminRules />}
      </div>
    </div>
  );
}
