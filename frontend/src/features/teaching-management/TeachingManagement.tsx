import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Empty, Form, Input, Modal, Popconfirm, Select, Tooltip, Typography, message } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import CourseManagement from './CourseManagement';
import { TaskWorkspace } from './TaskWorkspace';

const { Text, Title } = Typography;
type CourseDetail = { id: string; name: string };
type TaskStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
type Task = { id: string; title: string; description: string; deadline: string | null; status: TaskStatus };
type TaskForm = { title: string; deadline?: dayjs.Dayjs; status: TaskStatus };
const statusMeta: Record<TaskStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  ACTIVE: { label: '进行中', color: 'green' },
  CLOSED: { label: '已结束', color: 'orange' }
};

export default function TeachingManagement() {
  const [course, setCourse] = useState<CourseDetail>();
  return course ? <CourseTasks course={course} onBack={() => setCourse(undefined)} /> : (
    <div className="teaching-management">
      <div className="teaching-management-heading"><Title level={3}>课程管理</Title></div>
      <CourseManagement onViewTasks={(id, name) => setCourse({ id, name })} />
    </div>
  );
}

function CourseTasks({ course, onBack }: { course: CourseDetail; onBack: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task>();
  const [viewingTaskId, setViewingTaskId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<TaskForm>();

  const loadTasks = useCallback(async () => {
    try {
      const response = await axios.get<Task[]>(`/api/courses/${course.id}/tasks`);
      setTasks(response.data);
    } catch {
      messageApi.error('作业列表加载失败');
    }
  }, [course.id, messageApi]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  function openTaskModal(task?: Task) {
    setEditingTask(task);
    form.setFieldsValue(task
      ? {
          title: task.title,
          deadline: task.deadline ? dayjs(task.deadline) : undefined,
          status: task.status
        }
      : {
          title: '',
          deadline: undefined,
          status: 'DRAFT'
        });
    setModalOpen(true);
  }

  async function saveTask() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        title: values.title,
        deadline: values.deadline?.toISOString() ?? null,
        status: 'DRAFT'
      };
      if (editingTask) {
        await axios.put<Task>(`/api/tasks/${editingTask.id}`, { ...payload, status: values.status });
      } else {
        await axios.post<Task>(`/api/courses/${course.id}/tasks`, payload);
      }
      setModalOpen(false);
      form.resetFields();
      setEditingTask(undefined);
      await loadTasks();
    } catch {
      messageApi.error('作业创建失败');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(task: Task) {
    try {
      await axios.delete(`/api/tasks/${task.id}`);
      messageApi.success('作业已删除');
      await loadTasks();
    } catch {
      messageApi.error('作业删除失败');
    }
  }

  const visible = tasks.filter((task) => task.title.toLowerCase().includes(keyword.trim().toLowerCase()));
  if (viewingTaskId) {
    return <TaskWorkspace taskId={viewingTaskId} onBack={() => {
      setViewingTaskId(undefined);
      void loadTasks();
    }} />;
  }

  return (
    <div className="course-tasks-page">
      {contextHolder}
      <section className="course-detail-heading">
        <div><Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>返回课程</Button><Title level={2}>{course.name}</Title><Text type="secondary">课程作业与测验</Text></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal()}>新建作业</Button>
      </section>
      <Card className="course-task-list">
        <div className="course-task-filters"><Input prefix={<SearchOutlined />} placeholder="搜索作业" value={keyword} onChange={(event) => setKeyword(event.target.value)} className="course-task-search" /></div>
        <div className="course-task-items">
          {visible.length === 0 && <Empty description="暂无作业" />}
          {visible.map((task) => (
            <article className="course-task-item" key={task.id}>
              <div className="course-task-main">
                <Button className="course-task-title-link" type="link" onClick={() => setViewingTaskId(task.id)}>{task.title}</Button>
                <Text type="secondary">截止时间：{task.deadline ? new Date(task.deadline).toLocaleString() : '不设截止时间'}</Text>
              </div>
              <div className="course-task-actions">
                <Tooltip title="编辑作业名称、截止时间和状态"><Button type="text" size="small" icon={<EditOutlined />} aria-label="编辑作业" onClick={() => openTaskModal(task)} /></Tooltip>
                <Popconfirm title="确定删除该作业？" onConfirm={() => void deleteTask(task)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="删除作业" />
                </Popconfirm>
              </div>
            </article>
          ))}
        </div>
      </Card>
      <Modal
        title={editingTask ? '编辑作业' : '新建作业'}
        open={modalOpen}
        confirmLoading={saving}
        onCancel={() => {
          setModalOpen(false);
          setEditingTask(undefined);
          form.resetFields();
        }}
        onOk={() => void saveTask()}
      >
        <Form form={form} layout="vertical" initialValues={{ status: 'DRAFT' }}>
          <Form.Item name="title" label="作业名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="deadline" label="截止时间"><DatePicker showTime className="full-width" /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={Object.entries(statusMeta).map(([value, item]) => ({ value, label: item.label }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
