import axios from 'axios';

const baseUrl = '/api/assignment-management';

export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'SUBMITTED' | 'REVIEWING' | 'COMPLETED' | 'ARCHIVED';
export type StudentStatus = 'ACTIVE' | 'INACTIVE';

export type CourseClass = {
  id: string;
  name: string;
  grade: string;
  description: string;
  studentCount: number;
  createdAt: string;
};

export type Student = {
  id: string;
  studentNo: string;
  name: string;
  classId: string;
  className: string;
  email: string;
  phone: string;
  status: StudentStatus;
  createdAt: string;
};

export type AssignmentCategory = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
};

export type AssignmentVersion = {
  id: string;
  assignmentId: string;
  version: number;
  studentId: string;
  studentName: string;
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
  note: string;
  status: AssignmentStatus;
  submittedAt: string;
};

export type Assignment = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  classId: string;
  className: string;
  status: AssignmentStatus;
  dueAt: string;
  currentVersion: number;
  versions: AssignmentVersion[];
  createdAt: string;
  updatedAt: string;
};

export type AssignmentInput = {
  title: string;
  description?: string;
  categoryId: string;
  classId: string;
  status: AssignmentStatus;
  dueAt?: string;
};

export type StudentInput = {
  studentNo: string;
  name: string;
  classId: string;
  email?: string;
  phone?: string;
  status: StudentStatus;
};

export type ClassInput = {
  name: string;
  grade?: string;
  description?: string;
};

export type CategoryInput = {
  name: string;
  description?: string;
};

export type AssignmentImportResult = {
  imported: number;
  errors: string[];
};

export async function fetchAssignmentData() {
  const [assignments, categories, classes, students] = await Promise.all([
    axios.get<Assignment[]>(`${baseUrl}/assignments`),
    axios.get<AssignmentCategory[]>(`${baseUrl}/categories`),
    axios.get<CourseClass[]>(`${baseUrl}/classes`),
    axios.get<Student[]>(`${baseUrl}/students`)
  ]);

  return {
    assignments: assignments.data,
    categories: categories.data,
    classes: classes.data,
    students: students.data
  };
}

export async function saveAssignment(input: AssignmentInput, id?: string) {
  const response = id
    ? await axios.put<Assignment>(`${baseUrl}/assignments/${id}`, input)
    : await axios.post<Assignment>(`${baseUrl}/assignments`, input);
  return response.data;
}

export async function deleteAssignment(id: string) {
  await axios.delete(`${baseUrl}/assignments/${id}`);
}

export async function uploadAssignmentVersion(assignmentId: string, studentId: string, note: string, file: File) {
  const formData = new FormData();
  formData.append('studentId', studentId);
  formData.append('note', note);
  formData.append('file', file);
  const response = await axios.post<Assignment>(`${baseUrl}/assignments/${assignmentId}/versions`, formData);
  return response.data;
}

export async function saveCategory(input: CategoryInput, id?: string) {
  const response = id
    ? await axios.put<AssignmentCategory>(`${baseUrl}/categories/${id}`, input)
    : await axios.post<AssignmentCategory>(`${baseUrl}/categories`, input);
  return response.data;
}

export async function deleteCategory(id: string) {
  await axios.delete(`${baseUrl}/categories/${id}`);
}

export async function saveClass(input: ClassInput, id?: string) {
  const response = id ? await axios.put<CourseClass>(`${baseUrl}/classes/${id}`, input) : await axios.post<CourseClass>(`${baseUrl}/classes`, input);
  return response.data;
}

export async function deleteClass(id: string) {
  await axios.delete(`${baseUrl}/classes/${id}`);
}

export async function saveStudent(input: StudentInput, id?: string) {
  const response = id ? await axios.put<Student>(`${baseUrl}/students/${id}`, input) : await axios.post<Student>(`${baseUrl}/students`, input);
  return response.data;
}

export async function deleteStudent(id: string) {
  await axios.delete(`${baseUrl}/students/${id}`);
}

export async function importAssignments(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post<AssignmentImportResult>(`${baseUrl}/assignments/import`, formData);
  return response.data;
}

export async function exportAssignments() {
  const response = await axios.get<Blob>(`${baseUrl}/assignments/export`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'assignments.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '操作失败';
}
