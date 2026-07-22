import { BookOutlined, CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, InboxOutlined, SearchOutlined, StopOutlined, TeamOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import type { FormInstance } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';

const { Text } = Typography;

type CourseStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
type Course = {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  studentCount: number;
  status: CourseStatus;
  teacherName?: string;
  staffIds?: string[];
  staffNames?: string[];
};
type TeacherOption = { id: string; displayName: string; role: 'TEACHER' | 'ASSISTANT' };
type CourseOptionsResponse = { teachers?: TeacherOption[] };
type CourseForm = { name: string; description: string; staffIds?: string[] };

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

export default function CourseManagement({ onViewTasks }: { onViewTasks: (courseId: string, courseName: string) => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<CourseStatus>();
  const [editingCourse, setEditingCourse] = useState<Course>();
  const [teachingStaff, setTeachingStaff] = useState<TeacherOption[]>([]);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CourseForm>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<Course[]>('/api/courses', { params: status ? { status } : undefined });
      setCourses(response.data);
    } catch {
      messageApi.error('课程列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi, status]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  async function openCourseModal(course?: Course) {
    setEditingCourse(course);
    form.setFieldsValue(course ? {
      name: course.name,
      description: course.description,
      staffIds: course.staffIds ?? [course.teacherId]
    } : { name: '', description: '', staffIds: [] });
    setCourseModalOpen(true);
    try {
      const response = await axios.get<CourseOptionsResponse>('/api/courses/options');
      setTeachingStaff(response.data.teachers ?? []);
    } catch {
      messageApi.error('任课教师列表加载失败');
    }
  }

  async function saveCourse() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editingCourse) {
        const input = editingCourse.staffIds === undefined
          ? { name: values.name, description: values.description }
          : values;
        await axios.put(`/api/courses/${editingCourse.id}`, input);
      }
      else await axios.post('/api/courses', values);
      setCourseModalOpen(false);
      await loadCourses();
      messageApi.success('课程已保存');
    } catch {
      messageApi.error('课程保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCourse(course: Course) {
    try {
      await axios.delete(`/api/courses/${course.id}`);
      await loadCourses();
      messageApi.success('课程已删除');
    } catch {
      messageApi.error('课程删除失败');
    }
  }

  async function changeStatus(course: Course, nextStatus: CourseStatus) {
    try {
      await axios.put(`/api/courses/${course.id}/status`, { status: nextStatus });
      await loadCourses();
    } catch {
      messageApi.error('课程状态更新失败');
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
      render: (name: string, course) => <Button type="link" onClick={() => onViewTasks(course.id, course.name)}>{name}</Button>
    },
    { title: '课程说明', dataIndex: 'description', ellipsis: true },
    {
      title: '任课教师',
      dataIndex: 'staffNames',
      width: 180,
      render: (names: string[] | undefined, course) => {
        const visibleNames = names?.length ? names : course.teacherName ? [course.teacherName] : [];
        return visibleNames.length ? <Space size={[4, 4]} wrap>{visibleNames.map((name) => <Tag key={name}>{name}</Tag>)}</Space> : '-';
      }
    },
    { title: '学生', dataIndex: 'studentCount', width: 100, align: 'center' },
    { title: '状态', dataIndex: 'status', width: 120, render: (value: CourseStatus) => <Tag color={statusColor[value]}>{statusLabel[value]}</Tag> },
    {
      title: '操作',
      key: 'actions',
      width: 112,
      render: (_, course) => (
        <Space className="course-table-actions" size={0}>
          <Tooltip title="编辑课程"><Button type="text" icon={<EditOutlined />} aria-label="编辑课程" onClick={() => void openCourseModal(course)} /></Tooltip>
          {course.status === 'DRAFT' && <Tooltip title="发布课程"><Button type="text" icon={<UploadOutlined />} aria-label="发布课程" onClick={() => void changeStatus(course, 'ACTIVE')} /></Tooltip>}
          {course.status === 'ACTIVE' && <Tooltip title="结束课程"><Button type="text" icon={<StopOutlined />} aria-label="结束课程" onClick={() => void changeStatus(course, 'CLOSED')} /></Tooltip>}
          {course.status === 'CLOSED' && <Tooltip title="归档课程"><Button type="text" icon={<InboxOutlined />} aria-label="归档课程" onClick={() => void changeStatus(course, 'ARCHIVED')} /></Tooltip>}
          <Popconfirm title="确定删除该课程？" onConfirm={() => void deleteCourse(course)}>
            <Tooltip title="删除课程"><Button type="text" danger icon={<DeleteOutlined />} aria-label="删除课程" /></Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const active = courses.filter((course) => course.status === 'ACTIVE').length;
  const closed = courses.filter((course) => course.status === 'CLOSED').length;
  const students = courses.reduce((sum, course) => sum + course.studentCount, 0);

  return (
    <Space direction="vertical" size={12} className="content-stack">
      {contextHolder}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}><Card className="course-overview-card"><Statistic title="全部课程" value={courses.length} prefix={<BookOutlined />} /></Card></Col>
        <Col xs={24} sm={8}><Card className="course-overview-card"><Statistic title="进行中课程" value={active} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="course-overview-card"><Statistic title="课程学生数" value={students} prefix={<TeamOutlined />} suffix={<Text type="secondary">已结束 {closed}</Text>} /></Card></Col>
      </Row>
      <Card className="course-management-card" title="课程列表" extra={<Space><Button type="primary" onClick={() => void openCourseModal()}>新建课程</Button><Button icon={<CheckCircleOutlined />} onClick={() => void loadCourses()}>刷新</Button></Space>}>
        <Space wrap size={12} className="course-toolbar">
          <Input prefix={<SearchOutlined />} placeholder="搜索课程名称或说明" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <Select<CourseStatus> allowClear placeholder="全部状态" value={status} onChange={setStatus} options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))} />
        </Space>
        <Table<Course> className="course-table" size="small" rowKey="id" loading={loading} dataSource={visibleCourses} columns={columns} scroll={{ x: 900 }} pagination={{ pageSize: 8, showSizeChanger: false }} />
      </Card>
      <FormModal open={courseModalOpen} course={editingCourse} teachingStaff={teachingStaff} saving={saving} form={form} onCancel={() => setCourseModalOpen(false)} onSave={() => void saveCourse()} />
    </Space>
  );
}

function FormModal({ open, course, teachingStaff, saving, form, onCancel, onSave }: { open: boolean; course?: Course; teachingStaff: TeacherOption[]; saving: boolean; form: FormInstance<CourseForm>; onCancel: () => void; onSave: () => void }) {
  return <Modal title={course ? '编辑课程' : '新建课程'} open={open} confirmLoading={saving} onCancel={onCancel} onOk={onSave} destroyOnClose>
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}><Input maxLength={100} /></Form.Item>
      <Form.Item name="description" label="课程说明" rules={[{ required: true, message: '请输入课程说明' }]}><Input.TextArea rows={3} maxLength={500} /></Form.Item>
      <Form.Item name="staffIds" label="任课教师"><Select mode="multiple" showSearch optionFilterProp="label" placeholder="输入姓名或账号选择教师" options={teachingStaff.map((teacher) => ({ value: teacher.id, label: `${teacher.displayName}（${teacher.role === 'TEACHER' ? '教师' : '助教'}）` }))} /></Form.Item>
    </Form>
  </Modal>;
}
