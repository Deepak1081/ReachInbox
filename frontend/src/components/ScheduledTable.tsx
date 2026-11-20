import React, { useState } from 'react';
import { Clock, RefreshCw, ChevronLeft, ChevronRight, Inbox, Tag } from 'lucide-react';
import { useScheduledEmails } from '../services/apiService.js';
import { ScheduledEmailItem } from '../types/index.js';

interface ScheduledTableProps {
  searchResults?: ScheduledEmailItem[] | null;
  onRefresh?: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({ searchResults, onRefresh }) => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, refetch, isFetching } = useScheduledEmails(page, 15, statusFilter || undefined);

  // If search results are passed, show search results
  const items = searchResults !== null && searchResults !== undefined ? searchResults : data?.items || [];
  const total = searchResults !== null && searchResults !== undefined ? searchResults.length : data?.total || 0;
  const totalPages = searchResults !== null && searchResults !== undefined ? 1 : data?.totalPages || 1;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Processing
          </span>
        );
      case 'scheduled':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" />
            Scheduled
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Filter Status:
          </span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                !statusFilter ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Scheduled
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'scheduled' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Waiting
            </button>
            <button
              onClick={() => setStatusFilter('processing')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'processing' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Processing
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-700">{items.length}</strong> of <strong className="text-slate-700">{total}</strong> jobs
          </span>
          <button
            onClick={() => {
              refetch();
              onRefresh?.();
            }}
            title="Refresh jobs"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/75">
              <th className="py-3 px-4">Recipient</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">Sender</th>
              <th className="py-3 px-4">Scheduled For</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Job ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium text-slate-400">Loading queue jobs...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-400">
                    <Inbox className="w-10 h-10 stroke-1 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No scheduled emails</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Compose a new email campaign or upload a recipient CSV to schedule deliveries.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((email) => (
                <tr key={email.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    {email.recipientEmail}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate" title={email.subject}>
                    {email.subject}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-xs">
                    {email.sender?.displayName || email.sender?.email || 'Default Sender'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-xs font-mono">
                    {formatDate(email.scheduledAt)}
                  </td>
                  <td className="py-3.5 px-4">
                    {getStatusBadge(email.status)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      <Tag className="w-3 h-3 text-slate-400" />
                      {email.bullJobId ? email.bullJobId.replace('email-job-', '#') : 'queued'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!searchResults && totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
