import axios from 'axios';
import { getApiErrorMessage } from '../assignment-management/api';
import type { Assignment, AssignmentVersion, Student } from '../assignment-management/api';
import type { RubricTemplate } from '../system-admin/api';
import { fetchAssignmentData } from '../assignment-management/api';
import { fetchSystemAdminData } from '../system-admin/api';

const baseUrl = '/api/evaluation';

export type EvaluationTaskStatus = 'PENDING_CONFIGURATION' | 'AUTO_SCORED' | 'REVIEWED';

export type EvaluationDimensionScore = {
  dimensionName: string;
  weight: number;
  maxScore: number;
  score: number;
  basis: string;
};

export type EvaluationIssue = {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  locationHint: string;
};

export type EvaluationSuggestion = {
  id: string;
  title: string;
  details: string;
  scoreBand: string;
};

export type EvaluationReviewRecord = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  originalScore: number;
  revisedScore: number;
  reason: string;
  reviewedAt: string;
};

export type EvaluationTask = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  sourceVersionId: string;
  sourceVersionNumber: number;
  rubricTemplateId: string;
  rubricTemplateName: string;
  rubricVersion: number;
  status: EvaluationTaskStatus;
  autoScore: number;
  finalScore?: number | null;
  summary: string;
  dimensionScores: EvaluationDimensionScore[];
  issues: EvaluationIssue[];
  suggestions: EvaluationSuggestion[];
  reviewRecords: EvaluationReviewRecord[];
  createdAt: string;
  updatedAt: string;
};

export type EvaluationSnapshot = {
  tasks: EvaluationTask[];
  totalTasks: number;
  pendingConfigurationCount: number;
  reviewedCount: number;
};

export type EvaluationTaskInput = {
  assignmentId: string;
  studentId: string;
  sourceVersionId?: string;
  rubricTemplateId: string;
  operator: string;
};

export type EvaluationReviewInput = {
  reviewerId: string;
  reviewerName?: string;
  revisedScore?: number;
  reason: string;
};

export type EvaluationPageData = {
  snapshot: EvaluationSnapshot;
  assignments: Assignment[];
  students: Student[];
  templates: RubricTemplate[];
};

export { getApiErrorMessage };

export async function fetchEvaluationData(): Promise<EvaluationPageData> {
  const [snapshotResponse, assignmentData, systemData] = await Promise.all([
    axios.get<EvaluationSnapshot>(baseUrl),
    fetchAssignmentData(),
    fetchSystemAdminData()
  ]);

  return {
    snapshot: snapshotResponse.data,
    assignments: assignmentData.assignments,
    students: assignmentData.students,
    templates: systemData.templates
  };
}

export async function createEvaluationTask(input: EvaluationTaskInput) {
  const response = await axios.post<EvaluationTask>(`${baseUrl}/tasks`, input);
  return response.data;
}

export async function reviewEvaluationTask(taskId: string, input: EvaluationReviewInput) {
  const response = await axios.post<EvaluationTask>(`${baseUrl}/tasks/${taskId}/reviews`, input);
  return response.data;
}

export function resolveAssignmentVersions(assignments: Assignment[], assignmentId?: string): AssignmentVersion[] {
  if (!assignmentId) {
    return [];
  }
  return assignments.find((assignment) => assignment.id === assignmentId)?.versions ?? [];
}
