import { BookOutlined, CheckCircleOutlined, ClockCircleOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredSession } from '../auth/api';

const { Text } = Typography;

type CourseStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
type Course = {
  id: string;
  name: string;
  description: string;
  studentCount: number;
  status: CourseStatus;
  teacherName?: string;
  updatedAt?: string;
};
type CourseOption = { id: string; name: string; studentCount?: number };
type StudentOption = { id: string; studentNumber: string; studentName: string };
type TeacherOption = { id: string; displayName: string; role: 'TEACHER' | 'ASSISTANT' };
type CourseOptions = { groups: CourseOption[]; students: StudentOption[]; teachers: TeacherOption[] };
type CourseStudentOptionResponse = { id: string; number: string; name: string };
type CourseOptionsResponse = {
  groups?: CourseOption[];
  students?: CourseStudentOptionResponse[];
  teachers?: TeacherOption[];
};
type ApiErrorResponse = { message?: string; error?: string };
type CourseForm = { name: string; description: string; staffIds?: string[]; groupIds?: string[] };

const emptyCourseOptions: CourseOptions = { groups: [], students: [], teachers: [] };

function normalizeCourseOptions(options: CourseOptionsResponse | undefined): CourseOptions {
  return {
    groups: Array.isArray(options?.groups) ? options.groups : [],
    students: Array.isArray(options?.students)
      ? options.students.map((student) => ({
          id: student.id,
          studentNumber: student.number,
          studentName: student.name
        }))
      : [],
    teachers: Array.isArray(options?.teachers) ? options.teachers : []
  };
}

const statusLabel: Record<CourseStatus, string> = {
  DRAFT: '草稿',
  ACTIVE: '进行中',
  CLOSED: '已结束',
  ARCHIVED: '已归档'
};

const statusColor: Record<CourseStatus, string> = {
  DRAFT: 'default',
  ACTIVE: 'green',
  CLOSED: 'orange',
  ARCHIVED: 'blue'
};

export default function CourseManagement({
  onViewTasks
}: {
  onViewTasks: (courseId: string, courseName: string) => void;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<CourseStatus | undefined>();
  const [editingCourse, setEditingCourse] = useState<Course | undefined>();
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [courseStudents, setCourseStudents] = useState<StudentOption[]>([]);
  const [options, setOptions] = useState<CourseOptions>(emptyCourseOptions);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CourseForm>();
  const [apiMessage, contextHolder] = message.useMessage();

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<Course[]>('/api/courses', { params: status ? { status } : undefined });
      setCourses(response.data);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  async function openCourseModal(course?: Course) {
    setEditingCourse(course);
    if (course) form.setFieldsValue({ name: course.name, description: course.description });
    else {
      form.resetFields();
      const currentTeacherId = getStoredSession()?.id;
      form.setFieldsValue({ staffIds: currentTeacherId ? [currentTeacherId] : [] });
    }
    setOptions(emptyCourseOptions);
    setCourseModalOpen(true);
    try {
      const response = await axios.get<CourseOptionsResponse>('/api/courses/options');
      setOptions(normalizeCourseOptions(response.data));
    } catch {
      apiMessage.error('无法加载学生和组别选项');
    }
  }

  async function saveCourse() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editingCourse) await axios.put(`/api/courses/${editingCourse.id}`, values);
      else await axios.post('/api/courses', values);
      setCourseModalOpen(false);
      await loadCourses();
      apiMessage.success('课程已保存');
    } catch (error) {
      const reason = axios.isAxiosError<ApiErrorResponse>(error)
        ? error.response?.data?.message ?? error.response?.data?.error
        : error instanceof Error
          ? error.message
          : undefined;
      apiMessage.error(reason ?? '课程保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function openStudents(course: Course) {
    try {
      const response = await axios.get<Array<{ id: string; studentNumber: string; name: string }>>(`/api/courses/${course.id}/students`);
      setCourseStudents(response.data.map((student) => ({ id: student.id, studentNumber: student.studentNumber, studentName: student.name })));
      setStudentModalOpen(true);
    } catch {
      apiMessage.error('无法加载课程学生');
    }
  }

  async function deleteCourse(course: Course) {
    try {
      await axios.delete(`/api/courses/${course.id}`);
      await loadCourses();
      apiMessage.success('课程已删除');
    } catch {
      apiMessage.error('课程删除失败');
    }
  }

  async function changeStatus(course: Course, nextStatus: CourseStatus) {
    try {
      await axios.put(`/api/courses/${course.id}/status`, { status: nextStatus });
      await loadCourses();
    } catch {
      apiMessage.error('课程状态更新失败');
    }
  }

  const visibleCourses = useMemo(
    () => courses.filter((course) => `${course.name} ${course.description}`.toLowerCase().includes(keyword.trim().toLowerCase())),
    [courses, keyword]
  );

  const columns: ColumnsType<Course> = [
    {
      title: '课程名称',
      dataIndex: 'name',
      width: 220,
      render: (name: string, course) => (
        <Button type="link" onClick={() => onViewTasks(course.id, course.name)}>{name}</Button>
      )
    },
    { title: '课程说明', dataIndex: 'description', ellipsis: true },
    { title: '任课教师', dataIndex: 'teacherName', width: 130, render: (value?: string) => value ?? '-' },
    { title: '学生', dataIndex: 'studentCount', width: 100, align: 'center' },
    { title: '状态', dataIndex: 'status', width: 120, render: (value: CourseStatus) => <Tag color={statusColor[value]}>{statusLabel[value]}</Tag> },
    {
      title: '操作',
      key: 'actions',
      width: 128,
      fixed: 'right',
      render: (_, course) => (
        <Space className="course-table-actions" size={0}>
          <Button type="link" onClick={() => onViewTasks(course.id, course.name)}>进入</Button>
          <Button type="link" onClick={() => void openStudents(course)}>学生</Button>
          <Button type="link" onClick={() => void openCourseModal(course)}>编辑</Button>
          {course.status === 'DRAFT' && <Button type="link" onClick={() => void changeStatus(course, 'ACTIVE')}>发布</Button>}
          {course.status === 'ACTIVE' && <Button type="link" onClick={() => void changeStatus(course, 'CLOSED')}>结束</Button>}
          {course.status === 'CLOSED' && <Button type="link" onClick={() => void changeStatus(course, 'ARCHIVED')}>归档</Button>}
          <Popconfirm title="确定删除该课程？" onConfirm={() => void deleteCourse(course)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const active = courses.filter((course) => course.status === 'ACTIVE').length;
  const closed = courses.filter((course) => course.status === 'CLOSED').length;
  const students = courses.reduce((sum, course) => sum + course.studentCount, 0);

  return (
    <Space direction="vertical" size={18} className="content-stack">
      {contextHolder}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="course-overview-card"><Statistic title="全部课程" value={courses.length} prefix={<BookOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="course-overview-card"><Statistic title="进行中课程" value={active} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1677ff' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="course-overview-card"><Statistic title="课程学生数" value={students} prefix={<TeamOutlined />} suffix={<Text type="secondary">已结束 {closed}</Text>} /></Card>
        </Col>
      </Row>

      <Card className="course-management-card" title="课程列表" extra={<Space><Button type="primary" onClick={() => void openCourseModal()}>新建课程</Button><Button icon={<CheckCircleOutlined />} onClick={() => void loadCourses()}>刷新</Button></Space>}>
        <Space wrap size={12} className="course-toolbar">
          <Input prefix={<SearchOutlined />} placeholder="搜索课程名称或说明" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <Select<CourseStatus | undefined>
            allowClear
            placeholder="全部状态"
            value={status}
            onChange={setStatus}
            options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))}
          />
        </Space>
        <Table<Course>
          className="course-table"
          rowKey="id"
          loading={loading}
          dataSource={visibleCourses}
          columns={columns}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 8, showSizeChanger: false }}
        />
      </Card>
      <Modal
        title={editingCourse ? '编辑课程' : '新建课程'}
        open={courseModalOpen}
        confirmLoading={saving}
        onCancel={() => setCourseModalOpen(false)}
        onOk={() => void saveCourse()}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="课程说明" rules={[{ required: true, message: '请输入课程说明' }]}>
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <Form.Item name="staffIds" label="课程教师">
            <Select mode="multiple" allowClear placeholder="创建教师已默认选中，可继续选择" options={options.teachers.map((teacher) => ({
              value: teacher.id,
              label: `${teacher.displayName}（${teacher.role === 'TEACHER' ? '教师' : '助教'}）`
            }))} />
          </Form.Item>
          <Form.Item name="groupIds" label="学生组别">
            <Select mode="multiple" allowClear options={options.groups.map((group) => ({ value: group.id, label: `${group.name} (${group.studentCount ?? 0})` }))} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="课程学生" open={studentModalOpen} footer={null} onCancel={() => setStudentModalOpen(false)}>
        <Table<StudentOption> rowKey="id" size="small" pagination={false} dataSource={courseStudents} columns={[
          { title: '学号', dataIndex: 'studentNumber' },
          { title: '姓名', dataIndex: 'studentName' }
        ]} />
      </Modal>
    </Space>
  );
}
