import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Send,
  Zap,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { useSenders, useScheduleEmails } from '../services/apiService.js';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { data: senders } = useSenders();
  const scheduleMutation = useScheduleEmails();

  // Form states
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderId, setSenderId] = useState('');
  const [startTime, setStartTime] = useState(() => {
    // Default to current local time formatted for datetime-local input
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [delayBetweenEmails, setDelayBetweenEmails] = useState<number>(2000); // 2000 ms = 2s
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  // Manual & CSV Recipient states
  const [manualEmailInput, setManualEmailInput] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [invalidEmailsCount, setInvalidEmailsCount] = useState<number>(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stepper: 'compose' | 'confirm'
  const [step, setStep] = useState<'compose' | 'confirm'>('compose');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set default sender when senders list loads
  React.useEffect(() => {
    if (senders && senders.length > 0 && !senderId) {
      const def = senders.find((s) => s.isDefault) || senders[0];
      setSenderId(def.id);
    }
  }, [senders, senderId]);

  if (!isOpen) return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Process text or CSV content
  const handleParseEmails = (file: File) => {
    setFileName(file.name);
    setErrorMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const detectedEmails: string[] = [];
        let invalidCount = 0;

        if (results.data && results.data.length > 0) {
          // Check common column names
          results.data.forEach((row: any) => {
            let emailValue = '';
            for (const key of Object.keys(row)) {
              const lowerKey = key.toLowerCase().trim();
              if (
                lowerKey === 'email' ||
                lowerKey === 'recipient' ||
                lowerKey === 'to' ||
                lowerKey === 'e-mail' ||
                lowerKey === 'mail' ||
                lowerKey === 'email address'
              ) {
                emailValue = row[key];
                break;
              }
            }

            // If not found in known column, check if any cell matches email regex
            if (!emailValue) {
              for (const key of Object.keys(row)) {
                if (typeof row[key] === 'string' && emailRegex.test(row[key].trim())) {
                  emailValue = row[key];
                  break;
                }
              }
            }

            if (emailValue && typeof emailValue === 'string') {
              const cleaned = emailValue.trim().toLowerCase();
              if (emailRegex.test(cleaned)) {
                detectedEmails.push(cleaned);
              } else {
                invalidCount++;
              }
            }
          });
        }

        // If header parsing found nothing, fallback to raw lines
        if (detectedEmails.length === 0) {
          Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (rawResults) => {
              const rawList: string[] = [];
              rawResults.data.forEach((row: any) => {
                if (Array.isArray(row)) {
                  row.forEach((cell) => {
                    if (typeof cell === 'string') {
                      const c = cell.trim().toLowerCase();
                      if (emailRegex.test(c)) {
                        rawList.push(c);
                      }
                    }
                  });
                }
              });
              const unique = Array.from(new Set(rawList));
              setParsedRecipients(unique);
              setInvalidEmailsCount(invalidCount);
            },
          });
          return;
        }

        const unique = Array.from(new Set(detectedEmails));
        setParsedRecipients(unique);
        setInvalidEmailsCount(invalidCount);
      },
      error: (err) => {
        setErrorMessage(`Failed to parse CSV: ${err.message}`);
      },
    });
  };

  const handleAddManualEmail = () => {
    if (!manualEmailInput.trim()) return;
    const emailsToAdd = manualEmailInput
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    let invalids = 0;
    const valids: string[] = [];

    emailsToAdd.forEach((e) => {
      if (emailRegex.test(e)) {
        valids.push(e);
      } else {
        invalids++;
      }
    });

    setParsedRecipients((prev) => Array.from(new Set([...prev, ...valids])));
    setInvalidEmailsCount((prev) => prev + invalids);
    setManualEmailInput('');
  };

  const handleRemoveRecipient = (email: string) => {
    setParsedRecipients((prev) => prev.filter((e) => e !== email));
  };

  const handleClearRecipients = () => {
    setParsedRecipients([]);
    setFileName(null);
    setInvalidEmailsCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!subject.trim()) {
      setErrorMessage('Please enter an email subject');
      return;
    }
    if (!body.trim()) {
      setErrorMessage('Please enter an email body');
      return;
    }
    if (parsedRecipients.length === 0) {
      setErrorMessage('Please provide at least one valid recipient email');
      return;
    }
    if (!senderId) {
      setErrorMessage('Please select a sender account');
      return;
    }

    setStep('confirm');
  };

  const handleSubmitSchedule = async () => {
    setErrorMessage(null);
    try {
      await scheduleMutation.mutateAsync({
        subject,
        body,
        recipientEmails: parsedRecipients,
        senderId,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmails,
        hourlyLimit,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to schedule campaign');
      setStep('compose');
    }
  };

  const selectedSender = senders?.find((s) => s.id === senderId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {step === 'compose' ? 'Compose & Schedule Emails' : 'Confirm Campaign Schedule'}
              </h2>
              <p className="text-xs text-slate-500">
                {step === 'compose'
                  ? 'Configure queue delay, rate limits, and batch recipients'
                  : 'Review delivery parameters before enqueuing to BullMQ'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 'compose' ? (
            <form id="compose-form" onSubmit={handleProceedToConfirm} className="space-y-4">
              {/* Sender & Start Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    From (Sender Account) *
                  </label>
                  <select
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    required
                  >
                    {senders?.map((sender) => (
                      <option key={sender.id} value={sender.id}>
                        {sender.displayName} ({sender.email}) {sender.isDefault ? '• Default' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Start Date & Time (UTC/Local) *
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Subject *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Scaling outbound outreach with ReachInbox"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  required
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Message Body *
                </label>
                <textarea
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hi there,&#10;&#10;We noticed you're exploring high-volume transactional email scheduling..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none font-sans"
                  required
                />
              </div>

              {/* CSV Upload & Manual Recipient Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Recipients (CSV Upload or Manual Paste) *
                </label>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleParseEmails(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleParseEmails(e.target.files[0]);
                      }
                    }}
                    accept=".csv,.txt"
                    className="hidden"
                  />
                  <UploadCloud className="w-8 h-8 mx-auto text-indigo-500 mb-2" />
                  <p className="text-sm font-medium text-slate-700">
                    {fileName ? (
                      <span className="flex items-center justify-center gap-1.5 text-indigo-600 font-semibold">
                        <FileText className="w-4 h-4" /> {fileName}
                      </span>
                    ) : (
                      'Click to upload or drag & drop CSV file'
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Accepts .csv with email/recipient column or plain text (one email per line)
                  </p>
                </div>

                {/* Manual Paste Alternative */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={manualEmailInput}
                    onChange={(e) => setManualEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddManualEmail();
                      }
                    }}
                    placeholder="Or type/paste emails separated by commas..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualEmail}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Add
                  </button>
                </div>

                {/* Recipients Counter & Badges */}
                {parsedRecipients.length > 0 && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          {parsedRecipients.length} Valid Recipients
                        </span>
                        {invalidEmailsCount > 0 && (
                          <span className="flex items-center gap-1 text-rose-600 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {invalidEmailsCount} Invalid Skipped
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleClearRecipients}
                        className="text-slate-400 hover:text-slate-600 font-medium text-[11px]"
                      >
                        Clear All
                      </button>
                    </div>

                    {/* Preview first 8 chips */}
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                      {parsedRecipients.slice(0, 15).map((email, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white border border-slate-200 text-slate-700"
                        >
                          {email}
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(email)}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {parsedRecipients.length > 15 && (
                        <span className="px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          +{parsedRecipients.length - 15} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Speed & Rate Limiting Settings */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      Delay Between Emails
                    </label>
                    <span className="text-xs font-bold text-indigo-600">
                      {(delayBetweenEmails / 1000).toFixed(1)}s ({delayBetweenEmails}ms)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={10000}
                    step={500}
                    value={delayBetweenEmails}
                    onChange={(e) => setDelayBetweenEmails(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Minimum inter-email delay coordinated by Redis across all workers.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Hourly Sender Limit
                    </label>
                    <span className="text-xs font-bold text-amber-600">
                      {hourlyLimit} emails/hour
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={500}
                    step={10}
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Excess jobs automatically reschedule into the next hourly window.
                  </p>
                </div>
              </div>
            </form>
          ) : (
            /* Confirmation Step */
            <div className="space-y-4 py-2">
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                <h3 className="text-sm font-bold text-indigo-900 mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  Ready to Enqueue to BullMQ
                </h3>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  The scheduler will generate unique idempotency keys and enqueue delayed jobs in
                  Redis. Each email will be dispatched with calculated delay intervals.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-sm">
                <div className="px-4 py-3 flex justify-between">
                  <span className="text-slate-500">Subject:</span>
                  <span className="font-semibold text-slate-800 text-right">{subject}</span>
                </div>
                <div className="px-4 py-3 flex justify-between">
                  <span className="text-slate-500">Sender Account:</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    {selectedSender?.displayName} ({selectedSender?.email})
                  </span>
                </div>
                <div className="px-4 py-3 flex justify-between">
                  <span className="text-slate-500">Recipients Count:</span>
                  <span className="font-bold text-indigo-600">{parsedRecipients.length} emails</span>
                </div>
                <div className="px-4 py-3 flex justify-between">
                  <span className="text-slate-500">First Email Dispatch:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(startTime).toLocaleString()}
                  </span>
                </div>
                <div className="px-4 py-3 flex justify-between">
                  <span className="text-slate-500">Delay Interval:</span>
                  <span className="font-semibold text-slate-800">{delayBetweenEmails}ms between emails</span>
                </div>
                <div className="px-4 py-3 flex justify-between">
                  <span className="text-slate-500">Hourly Rate Limit:</span>
                  <span className="font-semibold text-slate-800">{hourlyLimit} emails/hour</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step === 'confirm' ? (
            <button
              type="button"
              onClick={() => setStep('compose')}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Back to Edit
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 'compose' ? (
            <button
              type="submit"
              form="compose-form"
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm shadow-indigo-600/30 transition-all"
            >
              <span>Review Schedule</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitSchedule}
              disabled={scheduleMutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm shadow-indigo-600/30 transition-all disabled:opacity-60"
            >
              {scheduleMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enqueuing to BullMQ...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Confirm & Schedule {parsedRecipients.length} Emails</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
