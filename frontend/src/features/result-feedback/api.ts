import axios from 'axios';
import type { Assignment, Student } from '../assignment-management/api';
import { fetchAssignmentData, getApiErrorMessage } from '../assignment-management/api';

const baseUrl = '/api/results';

export type DimensionScore = {
  name: string;
  score: number;
  maxScore: number;
  comment: string;
};

export type FeedbackLoopEntry = {
  id: string;
  actionType: 'SCORE_RELEASE' | 'REVIEW_UPDATE' | 'FEEDBACK_APPEND' | 'STUDENT_RESUBMIT';
  actor: string;
  comment: string;
  sourceVersionId: string;
  targetVersionId: string;
  createdAt: string;
};

export type ResultReport = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  sourceVersionId: string;
  sourceVersionNumber: number;
  overallScore: number;
  dimensions: DimensionScore[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  evaluator: string;
  teacherSummary: string;
  releasedAt: string;
  feedbackTrail: FeedbackLoopEntry[];
};

export type ClassDimensionAverage = {
  classId: string;
  className: string;
  dimension: string;
  averageScore: number;
};

export type ComparisonRow = {
  label: string;
  overallScore: number;
  versionNumber: number;
  className: string;
  studentName: string;
};

export type ResultSnapshot = {
  reports: ResultReport[];
  classAverages: ClassDimensionAverage[];
  studentHistory: ComparisonRow[];
  classComparison: ComparisonRow[];
};

export type ResultReportInput = {
  assignmentId: string;
  studentId: string;
  sourceVersionId?: string;
  dimensions: DimensionScore[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  evaluator: string;
  teacherSummary: string;
};

export { getApiErrorMessage };

export async function fetchResultData() {
  const [snapshot, assignmentData] = await Promise.all([
    axios.get<ResultSnapshot>(baseUrl),
    fetchAssignmentData()
  ]);
  return {
    snapshot: snapshot.data,
    assignments: assignmentData.assignments,
    students: assignmentData.students,
    classes: assignmentData.classes
  };
}

export async function saveResultReport(input: ResultReportInput) {
  const response = await axios.post<ResultReport>(`${baseUrl}/reports`, input);
  return response.data;
}

export async function appendReportFeedback(reportId: string, actor: string, comment: string) {
  const response = await axios.post<ResultReport>(`${baseUrl}/reports/${reportId}/feedback`, { actor, comment });
  return response.data;
}

export async function resubmitReport(reportId: string, studentId: string, note: string, file: File) {
  const formData = new FormData();
  formData.append('studentId', studentId);
  formData.append('note', note);
  formData.append('file', file);
  const response = await axios.post<ResultReport>(`${baseUrl}/reports/${reportId}/resubmit`, formData);
  return response.data;
}

export async function exportResultExcel(filters: { classId?: string; assignmentId?: string; studentId?: string }) {
  const response = await axios.get<Blob>(`${baseUrl}/export/excel`, {
    params: filters,
    responseType: 'blob'
  });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'result-report.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportResultPdf(reportId: string) {
  const response = await axios.get<Blob>(`${baseUrl}/reports/${reportId}/pdf`, {
    responseType: 'blob'
  });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'evaluation-report.pdf';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function fetchStudentHistory(studentId: string) {
  const response = await axios.get<ComparisonRow[]>(`${baseUrl}/history`, { params: { studentId } });
  return response.data;
}

export async function fetchAssignmentComparison(assignmentId: string) {
  const response = await axios.get<ComparisonRow[]>(`${baseUrl}/comparison`, { params: { assignmentId } });
  return response.data;
}

export type ResultLookupData = {
  assignments: Assignment[];
  students: Student[];
};

