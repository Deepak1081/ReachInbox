import React from 'react';
import {
  Clock,
  Send,
  Users,
  MessageSquare,
  Activity,
  LogOut,
  Mail,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { useSlackStatus } from '../services/apiService.js';

interface SidebarProps {
  activeTab: 'scheduled' | 'sent' | 'senders' | 'slack';
  setActiveTab: (tab: 'scheduled' | 'sent' | 'senders' | 'slack') => void;
  onOpenCompose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const { data: slackStatus } = useSlackStatus();

  const navItems = [
    {
      id: 'scheduled',
      label: 'Scheduled Emails',
      icon: Clock,
      badge: null,
    },
    {
      id: 'sent',
      label: 'Sent Emails',
      icon: Send,
      badge: null,
    },
    {
      id: 'senders',
      label: 'Sender Accounts',
      icon: Users,
      badge: null,
    },
    {
      id: 'slack',
      label: 'Slack Integration',
      icon: MessageSquare,
      badge: slackStatus?.connected ? 'Connected' : 'Setup',
      badgeColor: slackStatus?.connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300',
    },
  ];

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col h-screen border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Mail className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
            ReachInbox
            <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Pro
            </span>
          </span>
          <p className="text-[11px] text-slate-400">Email Job Scheduler</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Campaign Delivery
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Bull-Board Admin Dashboard External Link */}
        <div className="pt-5 px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Queue Infrastructure
        </div>

        <a
          href={`${import.meta.env.VITE_API_URL || '/api'}/admin/queues`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-emerald-400 group-hover:animate-pulse" />
            <span>BullMQ Dashboard</span>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-1 group-hover:text-emerald-400">
            Live ↗
          </span>
        </a>
      </div>

      {/* Hourly Limits Notice Card */}
      <div className="p-3 mx-3 mb-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-slate-200 mb-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Active Rate Limiter</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Atomic Redis Lua coordination with 2s inter-email gap & 200/hr limit.
        </p>
      </div>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`}
            alt={user?.name || 'Avatar'}
            className="w-9 h-9 rounded-full bg-slate-800 ring-2 ring-indigo-500/30 object-cover flex-shrink-0"
          />
          <div className="truncate">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
