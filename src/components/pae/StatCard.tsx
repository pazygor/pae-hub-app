import { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  variant?: 'default' | 'accent' | 'emergency' | 'success' | 'warning';
  icon?: LucideIcon;
}

export function StatCard({ label, value, variant = 'default', icon: Icon }: Props) {
  const colorMap = {
    default: 'text-foreground',
    accent: 'text-primary',
    emergency: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
  };

  const bgMap = {
    default: '',
    accent: 'border-primary/20',
    emergency: 'border-primary/20',
    success: 'border-success/20',
    warning: 'border-warning/20',
  };

  const iconBgMap = {
    default: 'bg-secondary text-muted-foreground',
    accent: 'bg-primary/10 text-primary',
    emergency: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
  };

  return (
    <div className={`bg-card border ${bgMap[variant]} p-6 rounded-[12px] shadow-md hover:shadow-lg transition-shadow`}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBgMap[variant]}`}>
            <Icon size={17} />
          </div>
        )}
      </div>
      <p className={`text-3xl font-mono-data font-bold ${colorMap[variant]}`}>
        {value.toString().padStart(2, '0')}
      </p>
    </div>
  );
}
