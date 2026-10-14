import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  GraduationCap,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { MANAGER_ROLES, roleLabel, useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { ContentReportRow, Department, DocumentRow, UploadResponse } from '../lib/types';

type Tab = 'documents' | 'disputes';

interface UploadForm {
  title: string;
  category: string;
  departmentId: string;
  semester: string;
  version: string;
  file: File | null;
}

const EMPTY_UPLOAD: UploadForm = {
  title: '',
  category: '',
  departmentId: 'institution',
  semester: '',
  version: '1',
  file: null,
};

const CATEGORIES = [
  'Examination',
  'Academic Regulation',
  'Timetable',
  'Syllabus',
  'Notice Circular',
  'Placement',
  'Laboratory',
  'Administration',
];

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PROCESSING: 'border-amber-200 bg-amber-50 text-amber-700',
  SUPERSEDED: 'border-slate-200 bg-slate-100 text-slate-600',
  OPEN: 'border-red-200 bg-red-50 text-red-700',
  RESOLVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

function statusChip(label: string) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
        STATUS_STYLES[label] ?? 'border-slate-200 bg-slate-100 text-slate-600'
      }`}
    >
      {label}
    </span>
  );
}

export default function AdminPortal() {
  const { user, logout } = useAuth();
  const canManage = Boolean(user && MANAGER_ROLES.includes(user.role));

  const [tab, setTab] = useState<Tab>('documents');
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [reports, setReports] = useState<ContentReportRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [upload, setUpload] = useState<UploadForm>(EMPTY_UPLOAD);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const scopeLabel = user?.departmentName
    ? `${user.departmentName} (${user.departmentCode})`
    : 'All departments';

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const departmentResponse = await apiFetch<{ departments: Department[] }>('/api/departments');
      setDepartments(departmentResponse.departments);

      if (canManage) {
        const [documentResponse, reportResponse] = await Promise.all([
          apiFetch<{ documents: DocumentRow[] }>('/api/admin/documents'),
          apiFetch<{ reports: ContentReportRow[] }>('/api/admin/reports?status=OPEN'),
        ]);
        setDocuments(documentResponse.documents);
        setReports(reportResponse.reports);
      }
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'Unable to load portal data.');
    } finally {
      setLoading(false);
    }
  }, [user, canManage]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const scopeOptions = useMemo(() => {
    if (!user) return [];
    if (user.role === 'DEPT_ADMIN' && user.departmentId) {
      return [{ id: user.departmentId, label: scopeLabel }];
    }
    return [
      { id: 'institution', label: 'Institution wide' },
      ...departments.map((department) => ({
        id: department.id,
        label: `${department.name} (${department.code})`,
      })),
    ];
  }, [user, departments, scopeLabel]);

  const defaultScope = scopeOptions[0]?.id ?? 'institution';

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!upload.file) {
      setUploadError('Select a PDF file to publish.');
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append('title', upload.title.trim());
      body.append('category', upload.category);
      body.append('departmentId', upload.departmentId || defaultScope);
      body.append('semester', upload.semester);
      body.append('version', upload.version || '1');
      body.append('file', upload.file);

      const response = await apiFetch<UploadResponse>('/api/admin/documents', {
        method: 'POST',
        body,
      });

      setNotice(
        `Published "${response.document.title}" v${response.document.version} with ${response.chunks} chunks.` +
          (response.supersededIds.length > 0
            ? ` ${response.supersededIds.length} earlier version(s) superseded.`
            : ''),
      );
      setUpload(EMPTY_UPLOAD);
      setUploadError(null);
      await loadAll();
      setTab('documents');
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleResolve = async (reportId: string) => {
    setActionError(null);
    setBusyId(reportId);
    try {
      await apiFetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        body: { note: 'Reviewed from the knowledge dispute desk.' },
      });
      setNotice('Report resolved and the action was written to the audit log.');
      await loadAll();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not resolve the report.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReplace = (report: ContentReportRow) => {
    if (!report.document) return;
    setUpload({
      title: report.document.title,
      category: CATEGORIES[0],
      departmentId: report.document.departmentId ?? defaultScope,
      semester: report.document.semester ? String(report.document.semester) : '',
      version: String(report.document.version + 1),
      file: null,
    });
    setUploadError(null);
    setActionError(null);
    setTab('documents');
    window.scrollTo({ top: 0 });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900">
              <GraduationCap className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">AI Campus Copilot</p>
              <p className="text-xs text-slate-500">Admin portal</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="text-right">
              <p className="font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">
                {roleLabel(user.role)} · {scopeLabel}
              </p>
            </div>
            <Link
              to="/privacy"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Privacy
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Scope summary */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Access scope
            </p>
            <p className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {scopeLabel}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Published documents
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {documents.filter((document) => document.status === 'PUBLISHED').length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Open disputes
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">{reports.length}</p>
          </div>
        </div>

        {notice && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {loadError && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {loadError}
            <button type="button" onClick={() => void loadAll()} className="ml-auto underline">
              Retry
            </button>
          </div>
        )}

        {!canManage && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Faculty accounts have read only access. Publishing and dispute resolution
            require a super admin or department admin account.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading portal data
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="mb-6 flex gap-2 border-b border-slate-200">
              {(
                [
                  { id: 'documents', label: 'Documents', icon: FileText },
                  { id: 'disputes', label: `Knowledge Dispute Desk (${reports.length})`, icon: AlertTriangle },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    tab === item.id
                      ? 'border-emerald-600 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'documents' && (
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Upload zone */}
                {canManage && (
                  <section className="lg:col-span-1">
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <UploadCloud className="h-4 w-4 text-emerald-600" />
                        Publish a document
                      </h2>
                      <p className="mt-1 mb-4 text-xs text-slate-500">
                        PDF text is chunked, embedded and pushed to the vector index.
                        Publishing a title that already exists supersedes older versions.
                      </p>

                      <form onSubmit={handleUpload} className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Title
                          </label>
                          <input
                            type="text"
                            required
                            value={upload.title}
                            onChange={(event) =>
                              setUpload((previous) => ({ ...previous, title: event.target.value }))
                            }
                            placeholder="Examination Schedule 2026"
                            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Category
                          </label>
                          <select
                            required
                            value={upload.category}
                            onChange={(event) =>
                              setUpload((previous) => ({ ...previous, category: event.target.value }))
                            }
                            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          >
                            <option value="">Select a category</option>
                            {CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Department scope
                          </label>
                          <select
                            value={upload.departmentId || defaultScope}
                            disabled={user.role === 'DEPT_ADMIN'}
                            onChange={(event) =>
                              setUpload((previous) => ({
                                ...previous,
                                departmentId: event.target.value,
                              }))
                            }
                            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-slate-50 disabled:text-slate-500"
                          >
                            {scopeOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {user.role === 'DEPT_ADMIN' && (
                            <p className="mt-1 text-xs text-slate-500">
                              Department admins publish only into their own department.
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">
                              Semester target
                            </label>
                            <select
                              value={upload.semester}
                              onChange={(event) =>
                                setUpload((previous) => ({
                                  ...previous,
                                  semester: event.target.value,
                                }))
                              }
                              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            >
                              <option value="">All semesters</option>
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
                                <option key={semester} value={semester}>
                                  Semester {semester}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">
                              Version
                            </label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={upload.version}
                              onChange={(event) =>
                                setUpload((previous) => ({
                                  ...previous,
                                  version: event.target.value,
                                }))
                              }
                              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            PDF file
                          </label>
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            required
                            onChange={(event) =>
                              setUpload((previous) => ({
                                ...previous,
                                file: event.target.files?.[0] ?? null,
                              }))
                            }
                            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-50"
                          />
                        </div>

                        {uploadError && (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            {uploadError}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={uploading}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Embedding and publishing
                            </>
                          ) : (
                            <>
                              <UploadCloud className="h-4 w-4" />
                              Upload and publish
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </section>
                )}

                {/* Document table */}
                <section className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <h2 className="text-base font-bold text-slate-900">Document management</h2>
                      <p className="text-xs text-slate-500">
                        Version history, ingestion status and supersede chain for your scope.
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Title</th>
                            <th className="px-3 py-3 font-semibold">Scope</th>
                            <th className="px-3 py-3 font-semibold">Version</th>
                            <th className="px-3 py-3 font-semibold">Status</th>
                            <th className="px-3 py-3 font-semibold">Superseded</th>
                            <th className="px-3 py-3 font-semibold">Chunks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {documents.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                                No documents in your scope yet. Publish the first PDF to build the
                                knowledge base.
                              </td>
                            </tr>
                          )}
                          {documents.map((document) => (
                            <tr key={document.id} className="align-top hover:bg-slate-50">
                              <td className="px-5 py-3">
                                <p className="font-semibold text-slate-900">{document.title}</p>
                                <p className="text-xs text-slate-500">
                                  {document.category}
                                  {document.semester ? ` · Semester ${document.semester}` : ''}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-600">{document.scope}</td>
                              <td className="px-3 py-3 text-xs font-semibold text-slate-700">
                                v{document.version}
                              </td>
                              <td className="px-3 py-3">
                                {statusChip(document.status)}
                                {document.openReports > 0 && (
                                  <span className="mt-1 block text-xs font-semibold text-red-600">
                                    {document.openReports} open report(s)
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-600">
                                {document.status === 'SUPERSEDED'
                                  ? document.supersededBy
                                    ? 'Replaced by a newer version'
                                    : 'Archived'
                                  : 'Current'}
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-600">
                                {document.chunkCount} chunks / {document.pageCount} pages
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {tab === 'disputes' && (
              <section className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-base font-bold text-slate-900">Knowledge dispute desk</h2>
                  <p className="text-xs text-slate-500">
                    Student reports about inaccurate or outdated copilot answers.
                  </p>
                </div>

                {actionError && (
                  <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {actionError}
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  {reports.length === 0 && (
                    <p className="px-5 py-12 text-center text-sm text-slate-500">
                      No open disputes. Every reported answer has been reviewed.
                    </p>
                  )}

                  {reports.map((report) => (
                    <article key={report.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {report.reason}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {report.query}
                          </p>
                          <p className="text-xs text-slate-500">
                            Reported by {report.student.name} (
                            {report.student.department?.code ?? 'No department'}
                            {report.student.semester ? `, semester ${report.student.semester}` : ''})
                            {' · '}
                            {new Date(report.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busyId === report.id || !canManage}
                            onClick={() => void handleResolve(report.id)}
                            className="flex items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Resolve
                          </button>
                          <button
                            type="button"
                            disabled={!report.document || !canManage}
                            onClick={() => handleReplace(report)}
                            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Replace document
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {report.answer && (
                        <blockquote className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                          {report.answer}
                        </blockquote>
                      )}

                      <p className="mt-2 text-xs text-slate-500">
                        Linked document:{' '}
                        {report.document
                          ? `${report.document.title} (v${report.document.version}, ${report.document.status})`
                          : 'No document linked'}
                        {report.detail ? ` · Detail: ${report.detail}` : ''}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
