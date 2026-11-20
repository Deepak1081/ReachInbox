import React, { useState } from 'react';
import { CheckCircle2, XCircle, ExternalLink, RefreshCw, ChevronLeft, ChevronRight, Inbox, AlertCircle } from 'lucide-react';
import { useSentEmails } from '../services/apiService.js';
import { ScheduledEmailItem } from '../types/index.js';

interface SentTableProps {
  searchResults?: ScheduledEmailItem[] | null;
  onRefresh?: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({ searchResults, onRefresh }) => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [activeErrorModal, setActiveErrorModal] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useSentEmails(page, 15, statusFilter || undefined);

  const items = searchResults !== null && searchResults !== undefined ? searchResults : data?.items || [];
  const total = searchResults !== null && searchResults !== undefined ? searchResults.length : data?.total || 0;
  const totalPages = searchResults !== null && searchResults !== undefined ? 1 : data?.totalPages || 1;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
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
              All Delivered
            </button>
            <button
              onClick={() => setStatusFilter('sent')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'sent' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sent (SMTP OK)
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'failed' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Failed
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-700">{items.length}</strong> of <strong className="text-slate-700">{total}</strong> emails
          </span>
          <button
            onClick={() => {
              refetch();
              onRefresh?.();
            }}
            title="Refresh emails"
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
              <th className="py-3 px-4">Sent At</th>
              <th className="py-3 px-4">Delivery Status</th>
              <th className="py-3 px-4 text-right">Ethereal Preview / Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium text-slate-400">Loading delivery logs...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-400">
                    <Inbox className="w-10 h-10 stroke-1 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No sent emails recorded</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Emails dispatched by BullMQ workers and confirmed by Ethereal SMTP will show here.
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
                    {email.sender?.displayName || email.sender?.email || 'Sender'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-xs font-mono">
                    {formatDate(email.sentAt)}
                  </td>
                  <td className="py-3.5 px-4">
                    {email.status === 'sent' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Sent (SMTP 250)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {email.etherealUrl ? (
                      <a
                        href={email.etherealUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/70 px-2.5 py-1 rounded-lg border border-indigo-200/60 transition-colors"
                      >
                        <span>View Email</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : email.errorMessage ? (
                      <button
                        onClick={() => setActiveErrorModal(email.errorMessage || 'Unknown error')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors"
                      >
                        <AlertCircle className="w-3 h-3" />
                        <span>View Error</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
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

      {/* Error Details Modal */}
      {activeErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-3">
            <div className="flex items-center gap-2 text-rose-600 font-bold">
              <AlertCircle className="w-5 h-5" />
              <span>SMTP Delivery Failure Details</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 font-mono text-xs text-slate-700 break-words whitespace-pre-wrap max-h-48 overflow-y-auto">
              {activeErrorModal}
            </div>
            <div className="text-right pt-2">
              <button
                onClick={() => setActiveErrorModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
