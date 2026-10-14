export type Role = 'SUPER_ADMIN' | 'DEPT_ADMIN' | 'FACULTY' | 'STUDENT';

export type DocumentStatus = 'PROCESSING' | 'PUBLISHED' | 'SUPERSEDED';

export type ReportStatus = 'OPEN' | 'RESOLVED';

export interface AuthClaims {
  id: string;
  email: string;
  role: Role;
  departmentId: string | null;
  semester: number | null;
}

export interface PublicProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  semester: number | null;
  homePath: string;
}

export interface LoginResponse {
  token: string;
  claims: AuthClaims;
  user: PublicProfile;
  redirectTo: string;
}

export interface Session {
  token: string;
  claims: AuthClaims;
  user: PublicProfile;
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface DocumentRow {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  fileName: string | null;
  pageCount: number;
  chunkCount: number;
  semester: number | null;
  version: number;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  departmentId: string | null;
  uploadedByUserId: string;
  scope: string;
  supersededBy: string | null;
  openReports: number;
  uploadedBy?: { id: string; name: string; email: string };
}

export interface UploadResponse {
  document: DocumentRow;
  supersededIds: string[];
  chunks: number;
  pages: number;
}

export interface SourceCitation {
  ref: number;
  documentId: string;
  title: string;
  category: string;
  page: number;
  version: number;
}

export interface ChatResponse {
  answer: string;
  sources: SourceCitation[];
  retrievedChunks: number;
  grounded: boolean;
}

export interface NoticeItem {
  id: string;
  title: string;
  body: string;
  semester: number | null;
  expiresAt: string | null;
  createdAt: string;
  scope: string;
}

export interface ReportStudent {
  id: string;
  name: string;
  email: string;
  semester: number | null;
  department: { code: string } | null;
}

export interface ReportDocument {
  id: string;
  title: string;
  version: number;
  status: DocumentStatus;
  departmentId: string | null;
  semester: number | null;
}

export interface ContentReportRow {
  id: string;
  query: string;
  answer: string | null;
  reason: string;
  detail: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  student: ReportStudent;
  document: ReportDocument | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
}
