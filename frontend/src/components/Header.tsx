import React from 'react';
import { Search, Plus, X } from 'lucide-react';

interface HeaderProps {
  title: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenCompose: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  searchQuery,
  setSearchQuery,
  onOpenCompose,
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          BullMQ Queue Active
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search input with Elasticsearch/DB fallback */}
        <div className="relative w-64 md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject, body, or recipient..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-sm text-slate-900 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Compose Button */}
        <button
          onClick={onOpenCompose}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm shadow-indigo-600/30 transition-all transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Compose New Email</span>
        </button>
      </div>
    </header>
  );
};
