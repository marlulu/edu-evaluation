import axios from 'axios';

const baseUrl = '/api/assignments';

// 类型定义
export type AssignmentInfo = {
  assignmentId: string;
  title: string;
  description?: string;
  criteriaText?: string;
  criteriaFileName?: string;
  classId?: string;
  deadline?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

// API 函数

export async function listAssignments(classId?: string, status?: string): Promise<{ assignments: AssignmentInfo[]; total: number }> {
  const params: Record<string, string> = {};
  if (classId) params.classId = classId;
  if (status) params.status = status;

  const response = await axios.get<{ assignments: AssignmentInfo[]; total: number }>(baseUrl, { params });
  return response.data;
}

export async function getAssignment(assignmentId: string): Promise<AssignmentInfo> {
  const response = await axios.get<AssignmentInfo>(`${baseUrl}/${assignmentId}`);
  return response.data;
}

export async function createAssignment(data: {
  title: string;
  description?: string;
  criteriaText?: string;
  criteriaFileName?: string;
  classId?: string;
  deadline?: string;
}): Promise<{ success: boolean; assignmentId: string }> {
  const response = await axios.post<{ success: boolean; assignmentId: string }>(baseUrl, data);
  return response.data;
}

export async function updateAssignment(assignmentId: string, data: {
  title?: string;
  description?: string;
  criteriaText?: string;
  criteriaFileName?: string;
  classId?: string;
  deadline?: string;
  status?: string;
}): Promise<{ success: boolean }> {
  const response = await axios.put<{ success: boolean }>(`${baseUrl}/${assignmentId}`, data);
  return response.data;
}

export async function deleteAssignment(assignmentId: string): Promise<{ success: boolean }> {
  const response = await axios.delete<{ success: boolean }>(`${baseUrl}/${assignmentId}`);
  return response.data;
}

export async function closeAssignment(assignmentId: string): Promise<{ success: boolean; status: string }> {
  const response = await axios.post<{ success: boolean; status: string }>(`${baseUrl}/${assignmentId}/close`);
  return response.data;
}
