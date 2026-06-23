interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  return <div className={`card card-pad-${padding} ${className}`}>{children}</div>;
}

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: string;
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div className="card card-pad-md stat-card">
      {icon && <span className="stat-icon">{icon}</span>}
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
