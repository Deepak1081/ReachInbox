import React from 'react';
import { MessageSquare, CheckCircle2, AlertTriangle, ShieldCheck, ExternalLink, Unlink } from 'lucide-react';
import { useSlackStatus, useDisconnectSlack } from '../services/apiService.js';

export const SlackModal: React.FC = () => {
  const { data: slackStatus, isLoading } = useSlackStatus();
  const disconnectMutation = useDisconnectSlack();

  const handleConnectSlack = () => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    window.location.href = `${apiBase}/slack/connect`;
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Slack OAuth 2.0 Integration</h2>
        <p className="text-xs text-slate-500">
          Connect your Slack workspace to receive real-time rate limit alerts when sender limits are reached.
        </p>
      </div>

      {/* Status Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#4A154B]/10 flex items-center justify-center text-[#4A154B]">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Slack Workspace</h3>
                {isLoading ? (
                  <span className="text-xs text-slate-400">Checking...</span>
                ) : slackStatus?.connected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {slackStatus?.connected
                  ? `Authenticated team: ${slackStatus.teamName || 'Slack Team'}`
                  : 'Authorize ReachInbox to post rate-limit and delivery notifications'}
              </p>
            </div>
          </div>

          <div>
            {slackStatus?.connected ? (
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                onClick={handleConnectSlack}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#4A154B] hover:bg-[#3d113e] text-white text-xs font-bold rounded-lg shadow-sm transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Connect Slack Workspace</span>
              </button>
            )}
          </div>
        </div>

        {/* Info Box explaining Slack Web API triggers */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Automated Alert Triggers
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 space-y-1">
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Hourly Limit Exceeded Alert
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Dispatched immediately when a sender hits the 200 emails/hour ceiling. Includes sender email, delayed email count, and next window time.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 space-y-1">
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                Redis Anti-Spam Deduplication
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Coordinated with Redis TTL lock (<code className="bg-slate-200 px-1 rounded">slack:notified:sender:window</code>) so workers send only 1 notification per hour window.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
