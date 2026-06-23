interface PillProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
}

export function Pill({ children, tone = 'neutral' }: PillProps) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
