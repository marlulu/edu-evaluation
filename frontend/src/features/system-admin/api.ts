import axios from 'axios';
import { getApiErrorMessage } from '../assignment-management/api';

const baseUrl = '/api/system-admin';

export type UserRole = 'ADMIN' | 'TEACHER' | 'ASSISTANT' | 'STUDENT';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED';
export type BackupStatus = 'READY' | 'RESTORED' | 'FAILED';

export type SystemUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: UserRole[];
  permissions: string[];
  dataScopes: string[];
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

export type SystemUserInput = {
  username: string;
  displayName: string;
  email?: string;
  roles: UserRole[];
  permissions: string[];
  dataScopes: string[];
  status: UserStatus;
};

export type RubricDimension = {
  name: string;
  weight: number;
  scoringRule: string;
};

export type RubricTemplate = {
  id: string;
  name: string;
  description: string;
  courseScope: string;
  status: TemplateStatus;
  currentVersion: number;
  dimensions: RubricDimension[];
  history: Array<{
    id: string;
    version: number;
    name: string;
    description: string;
    courseScope: string;
    status: TemplateStatus;
    dimensions: RubricDimension[];
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type RubricTemplateInput = {
  name: string;
  description?: string;
  courseScope?: string;
  status: TemplateStatus;
  dimensions: RubricDimension[];
};

export type AuditLog = {
  id: string;
  actor: string;
  operatedAt: string;
  action: string;
  objectType: string;
  objectId: string;
  result: string;
  detail: string;
};

export type BackupRecord = {
  id: string;
  name: string;
  scope: string;
  status: BackupStatus;
  operator: string;
  storagePath: string;
  createdAt: string;
  restoredAt?: string;
};

export type BackupInput = {
  name: string;
  scope?: string;
  operator?: string;
};

export type SystemAdminSnapshot = {
  users: SystemUser[];
  templates: RubricTemplate[];
  auditLogs: AuditLog[];
  backups: BackupRecord[];
};

export type AuditQuery = {
  actor?: string;
  action?: string;
  objectType?: string;
  result?: string;
};

export { getApiErrorMessage };

export async function fetchSystemAdminData() {
  const response = await axios.get<SystemAdminSnapshot>(baseUrl);
  return response.data;
}

export async function saveSystemUser(input: SystemUserInput, id?: string) {
  const response = id ? await axios.put<SystemUser>(`${baseUrl}/users/${id}`, input) : await axios.post<SystemUser>(`${baseUrl}/users`, input);
  return response.data;
}

export async function disableSystemUser(id: string) {
  const response = await axios.post<SystemUser>(`${baseUrl}/users/${id}/disable`);
  return response.data;
}

export async function saveRubricTemplate(input: RubricTemplateInput, id?: string) {
  const response = id ? await axios.put<RubricTemplate>(`${baseUrl}/rubric-templates/${id}`, input) : await axios.post<RubricTemplate>(`${baseUrl}/rubric-templates`, input);
  return response.data;
}

export async function copyRubricTemplate(id: string) {
  const response = await axios.post<RubricTemplate>(`${baseUrl}/rubric-templates/${id}/copy`);
  return response.data;
}

export async function fetchAuditLogs(query: AuditQuery) {
  const response = await axios.get<AuditLog[]>(`${baseUrl}/audit-logs`, { params: query });
  return response.data;
}

export async function exportAuditLogs(query: AuditQuery) {
  const response = await axios.get<Blob>(`${baseUrl}/audit-logs/export`, { params: query, responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'audit-logs.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function createBackup(input: BackupInput) {
  const response = await axios.post<BackupRecord>(`${baseUrl}/backups`, input);
  return response.data;
}

export async function restoreBackup(id: string, operator: string) {
  const response = await axios.post<BackupRecord>(`${baseUrl}/backups/${id}/restore`, null, { params: { operator } });
  return response.data;
}

