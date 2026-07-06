import axios from 'axios';

const baseUrl = '/api/classes';

// 类型定义
export type ClassInfo = {
  classId: string;
  className: string;
  description?: string;
  studentCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type StudentInfo = {
  studentId: string;
  classId: string;
  studentName: string;
  studentNumber?: string;
  workCount?: number;
  works?: WorkInfo[];
  createdAt?: string;
};

export type WorkInfo = {
  taskId: string;
  fileName: string;
  fileType?: string;
  status: string;
  progress: number;
  createdAt?: string;
};

// API 函数

// 班级管理
export async function listClasses(): Promise<{ classes: ClassInfo[]; total: number }> {
  const response = await axios.get<{ classes: ClassInfo[]; total: number }>(baseUrl);
  return response.data;
}

export async function getClass(classId: string): Promise<ClassInfo> {
  const response = await axios.get<ClassInfo>(`${baseUrl}/${classId}`);
  return response.data;
}

export async function createClass(className: string, description?: string): Promise<{ success: boolean; classId: string }> {
  const response = await axios.post<{ success: boolean; classId: string }>(baseUrl, { className, description });
  return response.data;
}

export async function updateClass(classId: string, className?: string, description?: string): Promise<{ success: boolean }> {
  const response = await axios.put<{ success: boolean }>(`${baseUrl}/${classId}`, { className, description });
  return response.data;
}

export async function deleteClass(classId: string): Promise<{ success: boolean }> {
  const response = await axios.delete<{ success: boolean }>(`${baseUrl}/${classId}`);
  return response.data;
}

// 学生管理
export async function listStudents(classId: string): Promise<{ students: StudentInfo[]; total: number }> {
  const response = await axios.get<{ students: StudentInfo[]; total: number }>(`${baseUrl}/${classId}/students`);
  return response.data;
}

export async function getStudent(studentId: string): Promise<StudentInfo> {
  const response = await axios.get<StudentInfo>(`${baseUrl}/students/${studentId}`);
  return response.data;
}

export async function createStudent(classId: string, studentName: string, studentNumber?: string): Promise<{ success: boolean; studentId: string }> {
  const response = await axios.post<{ success: boolean; studentId: string }>(`${baseUrl}/${classId}/students`, { studentName, studentNumber });
  return response.data;
}

export async function updateStudent(studentId: string, studentName?: string, studentNumber?: string): Promise<{ success: boolean }> {
  const response = await axios.put<{ success: boolean }>(`${baseUrl}/students/${studentId}`, { studentName, studentNumber });
  return response.data;
}

export async function deleteStudent(studentId: string): Promise<{ success: boolean }> {
  const response = await axios.delete<{ success: boolean }>(`${baseUrl}/students/${studentId}`);
  return response.data;
}

// 学生作品关联
export async function addWorkToStudent(studentId: string, taskId: string): Promise<{ success: boolean }> {
  const response = await axios.post<{ success: boolean }>(`${baseUrl}/students/${studentId}/works`, { taskId });
  return response.data;
}

export async function removeWorkFromStudent(studentId: string, taskId: string): Promise<{ success: boolean }> {
  const response = await axios.delete<{ success: boolean }>(`${baseUrl}/students/${studentId}/works/${taskId}`);
  return response.data;
}

// 批量导出
export async function exportClassWorksToPdf(classId: string): Promise<void> {
  const response = await fetch(`/api/work/export/pdf/class/${classId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('导出失败');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `班级作品报告_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function exportStudentWorksToPdf(studentId: string): Promise<void> {
  const response = await fetch(`/api/work/export/pdf/student/${studentId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    try {
      const err = await response.json();
      throw new Error(err.error || '导出失败');
    } catch {
      throw new Error('导出失败');
    }
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `学生作品报告_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function exportClassesWorksToPdf(classIds: string[]): Promise<void> {
  const response = await fetch(`/api/work/export/pdf/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ classIds }),
  });

  if (!response.ok) {
    throw new Error('导出失败');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `班级作品报告_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function exportStudentsWorksToPdf(studentIds: string[]): Promise<void> {
  const response = await fetch(`/api/work/export/pdf/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ studentIds }),
  });

  if (!response.ok) {
    throw new Error('导出失败');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `学生作品报告_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function exportStudentSelectedWorksToPdf(studentId: string, taskIds: string[]): Promise<void> {
  const response = await fetch(`/api/work/export/pdf/student/${studentId}/selected`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ taskIds }),
  });

  if (!response.ok) {
    throw new Error('导出失败');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `学生作品报告_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
