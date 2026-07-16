import axios from 'axios';

export type SubmissionRule = {
  allowedExtensions: string[];
  maxFileSizeBytes: number;
  ruleText: string | null;
  importedFileName: string | null;
  importedAt: string | null;
};

export type TaskDetail = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  deadline: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  rule: SubmissionRule;
  submissionCount: number;
};

export type Review = {
  score: number | null;
  feedback: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  aiTaskId: string | null;
  reviewerId: string | null;
  reviewedAt: string | null;
};

export type TaskSubmission = {
  id: string;
  studentId: string;
  fileName: string;
  contentType: string | null;
  fileSizeBytes: number | null;
  submittedAt: string;
  review: Review | null;
};

export type RuleImport = {
  fileName: string;
  ruleText: string;
  allowedExtensions: string[];
  maxFileSizeBytes: number | null;
};

export type SubmissionRuleInput = {
  allowedExtensions: string[];
  maxFileSizeBytes: number;
  ruleText: string | null;
  importedFileName: string | null;
};

export async function fetchTaskDetail(id: string) {
  return (await axios.get<TaskDetail>(`/api/tasks/${id}/detail`)).data;
}

export async function fetchTaskSubmissions(id: string) {
  return (await axios.get<TaskSubmission[]>(`/api/tasks/${id}/submissions`)).data;
}

export async function saveSubmissionRule(id: string, rule: SubmissionRuleInput) {
  return (await axios.put<SubmissionRule>(`/api/tasks/${id}/submission-rule`, rule)).data;
}

export async function importSubmissionRule(id: string, file: File) {
  const body = new FormData();
  body.append('file', file);
  return (await axios.post<RuleImport>(`/api/tasks/${id}/submission-rule/import`, body)).data;
}

export async function createReviewDrafts(id: string, submissionIds: string[]) {
  return (await axios.post(`/api/tasks/${id}/reviews/drafts`, submissionIds)).data;
}

export async function saveReview(id: string, submissionId: string, values: { score: number | null; feedback: string; publish: boolean }) {
  return (await axios.put<Review>(`/api/tasks/${id}/submissions/${submissionId}/review`, values)).data;
}
