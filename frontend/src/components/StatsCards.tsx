import React from 'react';
import { Mail, Clock, Send, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useEmailStats } from '../services/apiService.js';

export const StatsCards: React.FC = () => {
  const { data: stats, isLoading } = useEmailStats();

  const cards = [
    {
      label: 'Total Emails',
      value: stats?.total ?? 0,
      icon: Mail,
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      description: 'Total jobs enqueued',
    },
    {
      label: 'Scheduled',
      value: stats?.scheduled ?? 0,
      icon: Clock,
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      description: 'Pending delayed queue execution',
    },
    {
      label: 'Sent Successfully',
      value: stats?.sent ?? 0,
      icon: Send,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      description: 'SMTP delivery confirmed',
    },
    {
      label: 'Failed Delivery',
      value: stats?.failed ?? 0,
      icon: AlertTriangle,
      iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
      description: 'SMTP or delivery errors',
    },
    {
      label: 'Hourly Quota Left',
      value: `${stats?.hourlyQuotaRemaining ?? 200}/200`,
      icon: ShieldCheck,
      iconBg: 'bg-violet-50 text-violet-600 border-violet-100',
      description: 'Resets at start of next hour',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-white p-5 border border-slate-200/80 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-slate-100 mb-3" />
            <div className="w-16 h-5 bg-slate-100 rounded mb-1" />
            <div className="w-24 h-3 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${card.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {card.value}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {card.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};
