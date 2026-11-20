import React, { useState } from 'react';
import { Users, Plus, Trash2, CheckCircle2, ShieldCheck, Mail, Sparkles } from 'lucide-react';
import { useSenders, useCreateSender, useDeleteSender } from '../services/apiService.js';

export const SendersModal: React.FC = () => {
  const { data: senders, isLoading } = useSenders();
  const createMutation = useCreateSender();
  const deleteMutation = useDeleteSender();

  const [isAdding, setIsAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !displayName) {
      setError('Please provide email and display name');
      return;
    }

    try {
      await createMutation.mutateAsync({
        email,
        displayName,
        isDefault,
      });
      setEmail('');
      setDisplayName('');
      setIsDefault(false);
      setIsAdding(false);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create sender');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Configured Sender Accounts</h2>
          <p className="text-xs text-slate-500">
            Each sender holds an isolated SMTP transport with rate limiting (200 emails/hour).
          </p>
        </div>

        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Sender Account</span>
          </button>
        )}
      </div>

      {/* Add Sender Form */}
      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="bg-white p-5 rounded-xl border border-indigo-200/80 shadow-md shadow-indigo-500/5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Add Sender with Auto Ethereal SMTP Provisioning
            </h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
            >
              Cancel
            </button>
          </div>

          {error && <div className="text-xs text-rose-600 font-medium">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Sales at ReachInbox"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sender Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. outreach@domain.com"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              Set as Default Sender
            </label>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-60"
            >
              {createMutation.isPending ? 'Provisioning Ethereal SMTP...' : 'Create Sender'}
            </button>
          </div>
        </form>
      )}

      {/* Senders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            Loading sender accounts...
          </div>
        ) : !senders || senders.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
            <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">No senders found</p>
            <p className="text-xs text-slate-400 mt-1">
              Add your first sender account to start dispatching campaigns.
            </p>
          </div>
        ) : (
          senders.map((s) => (
            <div
              key={s.id}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm relative space-y-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{s.displayName}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{s.email}</p>
                </div>
                {s.isDefault ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                    Default
                  </span>
                ) : (
                  <button
                    onClick={() => deleteMutation.mutate(s.id)}
                    title="Delete sender"
                    className="text-slate-300 hover:text-rose-500 p-1 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>SMTP Host:</span>
                  <span className="font-mono text-slate-700">{s.smtpHost}</span>
                </div>
                <div className="flex justify-between">
                  <span>Port:</span>
                  <span className="font-mono text-slate-700">{s.smtpPort}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Window:</span>
                  <span className="text-emerald-600 font-semibold">200 emails / hr</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
