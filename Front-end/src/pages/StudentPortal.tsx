import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Check,
  Flag,
  GraduationCap,
  Loader2,
  LogOut,
  Megaphone,
  Pencil,
  RefreshCw,
  RotateCcwClock,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { roleLabel, useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { ChatMessage, ChatResponse, ContentReportRow, NoticeItem, SourceCitation } from '../lib/types';

const REPORT_REASONS = [
  'Incorrect information',
  'Outdated information',
  'Answer not supported by the cited source',
  'Wrong department or semester scope',
  'Other',
];

interface ReportDraft {
  messageId: string;
  query: string;
  answer: string;
  documentId: string | null;
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Ask me anything covered by the approved campus documents: examination schedules, regulations, lab rules, placements or department notices. Every answer cites the source document and page.',
};

const HISTORY_KEY = 'campus-copilot.qa-history';
const HISTORY_LIMIT = 100;

interface HistoryEntry {
  id: string;
  question: string;
  answer: string;
  sources: SourceCitation[];
  at: string;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export default function StudentPortal() {
  const { user, logout, updateProfile } = useAuth();

  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => readHistory());

  const [report, setReport] = useState<ReportDraft | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetail, setReportDetail] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const loadNotices = useCallback(async () => {
    setNoticesLoading(true);
    setNoticeError(null);
    try {
      const response = await apiFetch<{ notices: NoticeItem[] }>('/api/notices');
      setNotices(
        [...response.notices].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    } catch (caught) {
      setNoticeError(caught instanceof Error ? caught.message : 'Notices are unavailable.');
    } finally {
      setNoticesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotices();
  }, [loadNotices]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [settingsOpen]);

  if (!user) return null;

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || sending) return;

    setChatError(null);
    setSending(true);
    setDraft('');

    const userMessage: ChatMessage = { id: createId(), role: 'user', content: question };
    const history = [...messages, userMessage];
    setMessages([...history, { id: 'pending', role: 'assistant', content: '' }]);

    try {
      const response = await apiFetch<ChatResponse>('/api/chat', {
        method: 'POST',
        body: {
          message: question,
          history: history
            .filter((message) => message.id !== 'welcome' && message.content.length > 0)
            .map((message) => ({ role: message.role, content: message.content })),
        },
      });

      setMessages((previous) => [
        ...previous.filter((message) => message.id !== 'pending'),
        {
          id: createId(),
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
        },
      ]);

      setHistory((previous) => {
        const entry: HistoryEntry = {
          id: createId(),
          question,
          answer: response.answer,
          sources: response.sources ?? [],
          at: new Date().toISOString(),
        };
        const next = [entry, ...previous].slice(0, HISTORY_LIMIT);
        writeHistory(next);
        return next;
      });
    } catch (caught) {
      setMessages((previous) => previous.filter((message) => message.id !== 'pending'));
      setChatError(caught instanceof Error ? caught.message : 'The copilot is unavailable.');
      setDraft(question);
    } finally {
      setSending(false);
    }
  };

  const handleComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const openReport = (message: ChatMessage, source?: SourceCitation) => {
    setReportError(null);
    setReportReason(REPORT_REASONS[0]);
    setReportDetail('');
    setReport({
      messageId: message.id,
      query: lastUserQuestion(),
      answer: message.content,
      documentId: source?.documentId ?? message.sources?.[0]?.documentId ?? null,
    });
  };

  const lastUserQuestion = (): string => {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    return lastUser?.content ?? '';
  };

  const openNameDialog = () => {
    setNameDraft(user.name);
    setNameError(null);
    setSettingsOpen(false);
    setProfileOpen(true);
  };

  const handleSaveName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = nameDraft.trim();
    if (name.length < 2) {
      setNameError('Enter at least 2 characters.');
      return;
    }
    if (name.length > 80) {
      setNameError('Name must be 80 characters or fewer.');
      return;
    }
    updateProfile({ name });
    setNameError(null);
    setProfileOpen(false);
  };

  const handleClearHistory = () => {
    writeHistory([]);
    setHistory([]);
  };

  const handleRefreshApp = () => {
    setSettingsOpen(false);
    window.location.reload();
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!report || reportSubmitting) return;

    setReportError(null);
    setReportSubmitting(true);
    try {
      await apiFetch<ContentReportRow>('/api/reports', {
        method: 'POST',
        body: {
          query: report.query,
          answer: report.answer,
          reason: reportReason,
          detail: reportDetail.trim(),
          documentId: report.documentId,
        },
      });
      setReport(null);
      setReportSuccess(
        'Report submitted. A department admin will review the answer from the dispute desk.',
      );
      window.setTimeout(() => setReportSuccess(null), 6000);
    } catch (caught) {
      setReportError(caught instanceof Error ? caught.message : 'Could not submit the report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const profileLine = [
    user.departmentCode,
    user.semester ? `Semester ${user.semester}` : null,
    roleLabel(user.role),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900">
              <GraduationCap className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">AI Campus Copilot</p>
              <p className="text-xs text-slate-500">Student assistant</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-right">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="font-semibold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{profileLine}</p>
              </div>
            </div>
            <Link
              to="/terms"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Terms
            </Link>
            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => setSettingsOpen((previous) => !previous)}
                aria-haspopup="menu"
                aria-expanded={settingsOpen}
                aria-label="Open settings"
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Settings className={`h-3.5 w-3.5 ${settingsOpen ? 'text-emerald-600' : ''}`} />
                Settings
              </button>

              {settingsOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={openNameDialog}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <Pencil className="mt-0.5 h-4 w-4 text-slate-400" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        Change name
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Update your display name
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSettingsOpen(false);
                      setHistoryOpen(true);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <RotateCcwClock className="mt-0.5 h-4 w-4 text-slate-400" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">History</span>
                      <span className="block text-[11px] text-slate-500">
                        Review your past questions
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleRefreshApp}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <Wrench className="mt-0.5 h-4 w-4 text-slate-400" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        Troubleshoot
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Refresh the whole app at once
                      </span>
                    </span>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {/* Notices sidebar */}
        <aside className="w-full shrink-0 lg:w-80">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Megaphone className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Campus notices</h2>
              <button
                type="button"
                onClick={() => void loadNotices()}
                disabled={noticesLoading}
                aria-label="Refresh circulars"
                title="Refresh to load the most recent circulars"
                className="ml-auto flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${noticesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {noticeError && (
              <p className="px-4 py-3 text-xs text-red-600">{noticeError}</p>
            )}

            <div className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
              {notices.length === 0 && !noticeError && (
                <p className="flex items-center justify-center gap-2 px-4 py-6 text-center text-xs text-slate-500">
                  {noticesLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading the latest circulars
                    </>
                  ) : (
                    'No active notices for your department.'
                  )}
                </p>
              )}
              {notices.map((notice) => (
                <article key={notice.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{notice.title}</h3>
                    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                      {notice.scope}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{notice.body}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                    <Bell className="h-3 w-3" />
                    {new Date(notice.createdAt).toLocaleDateString()}
                    {notice.semester ? ` · Semester ${notice.semester}` : ''}
                    {notice.expiresAt
                      ? ` · expires ${new Date(notice.expiresAt).toLocaleDateString()}`
                      : ''}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </aside>

        {/* Copilot chat */}
        <section className="flex min-h-[70vh] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Copilot chat</h2>
              <p className="text-xs text-slate-500">
                Answers are limited to approved campus documents in your scope.
              </p>
            </div>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              Grounded retrieval
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  {message.content ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <span className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Retrieving approved sources
                    </span>
                  )}

                  {message.role === 'assistant' && message.id !== 'welcome' && (
                    <>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                          {message.sources.map((source) => (
                            <span
                              key={`${message.id}-${source.ref}`}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                            >
                              <span className="text-emerald-700">[{source.ref}]</span>
                              <span>{source.title}</span>
                              <span className="font-normal text-slate-500">
                                Page {source.page}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => openReport(message)}
                        className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-red-600 hover:text-red-700"
                      >
                        <Flag className="h-3.5 w-3.5" />
                        Report incorrect information
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {chatError && (
            <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {chatError}
            </div>
          )}

          {reportSuccess && (
            <div className="mx-5 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {reportSuccess}
            </div>
          )}

          <form onSubmit={handleSend} className="border-t border-slate-200 p-4">
            <div className="flex items-end gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKey}
                rows={2}
                maxLength={1200}
                placeholder="Ask about exam dates, regulations, labs or placements"
                className="block w-full resize-none rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                type="submit"
                disabled={sending || draft.trim().length === 0}
                className="flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Ask
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Enter sends, Shift + Enter adds a new line. Responses cite the exact document and page.
            </p>
          </form>
        </section>
      </div>

      {/* Report modal */}
      {report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Report an issue</h3>
                <p className="text-xs text-slate-500">
                  The dispute is sent to department admins for review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReport(null)}
                aria-label="Close report dialog"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="line-clamp-3">{report.answer}</p>
            </div>

            <form onSubmit={submitReport} className="mt-4 space-y-4">
              <div>
                <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Reason
                </label>
                <select
                  id="reason"
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="detail" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Detail (optional)
                </label>
                <textarea
                  id="detail"
                  value={reportDetail}
                  onChange={(event) => setReportDetail(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="What looks wrong, and what should the answer say instead?"
                  className="block w-full resize-none rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <p className="mt-1 text-[11px] text-slate-400">{reportDetail.length}/1000</p>
              </div>

              {reportError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {reportError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReport(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reportSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Flag className="h-4 w-4" />
                  )}
                  Submit report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change name modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Change display name</h3>
                <p className="text-xs text-slate-500">
                  The new name appears on your student dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                aria-label="Close name dialog"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveName} className="mt-4 space-y-4">
              <div>
                <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Full name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  maxLength={80}
                  autoFocus
                  placeholder="Your name"
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {nameError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {nameError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Check className="h-4 w-4" />
                  Save name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Question history</h3>
                <p className="text-xs text-slate-500">
                  Questions you asked and the answers the copilot returned on this device.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Close history dialog"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto px-6 py-4">
              {history.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-500">
                  No history yet. Ask the copilot a question and it will appear here.
                </p>
              )}
              {history.map((entry) => (
                <article key={entry.id} className="py-4 first:pt-0 last:pb-0">
                  <p className="text-xs text-slate-400">
                    {new Date(entry.at).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{entry.question}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                    {entry.answer}
                  </p>
                  {entry.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.sources.map((source) => (
                        <span
                          key={`${entry.id}-${source.ref}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                        >
                          <span className="text-emerald-700">[{source.ref}]</span>
                          <span>{source.title}</span>
                          <span className="font-normal text-slate-500">Page {source.page}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
