import { ArrowLeftOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Empty, Form, Input, Modal, Popconfirm, Select, Tag, Typography, Upload, message } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import CourseManagement from './CourseManagement';

const { Paragraph, Text, Title } = Typography;
type CourseDetail = { id: string; name: string };
type TaskStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
type Task = { id: string; title: string; description: string; deadline: string | null; status: TaskStatus };
type TaskAttachment = { fileName: string; downloadUrl: string; deleteUrl: string };
type TaskWithAttachments = Task & { attachments?: TaskAttachment[] };
type TaskForm = { title: string; description: string; deadline?: dayjs.Dayjs; status: TaskStatus };
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
  const [tasks, setTasks] = useState<TaskWithAttachments[]>([]);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task>();
  const [attachmentFiles, setAttachmentFiles] = useState<Array<{ uid: string; file: File }>>([]);
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
    setAttachmentFiles([]);
    form.setFieldsValue(task
      ? {
          title: task.title,
          description: task.description,
          deadline: task.deadline ? dayjs(task.deadline) : undefined,
          status: task.status
        }
      : {
          title: '',
          description: '',
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
        description: values.description,
        deadline: values.deadline?.toISOString() ?? null,
        status: 'DRAFT'
      };
      const taskId = editingTask
        ? (await axios.put<Task>(`/api/tasks/${editingTask.id}`, { ...payload, status: values.status })).data.id
        : (await axios.post<Task>(`/api/courses/${course.id}/tasks`, payload)).data.id;
      for (const attachment of attachmentFiles) {
        const body = new FormData();
        body.append('file', attachment.file);
        await axios.post(`/api/tasks/${taskId}/attachments`, body);
      }
      setModalOpen(false);
      form.resetFields();
      setEditingTask(undefined);
      setAttachmentFiles([]);
      await loadTasks();
    } catch {
      messageApi.error('作业创建失败');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAttachment(task: TaskWithAttachments, attachment: TaskAttachment) {
    try {
      await axios.delete(attachment.deleteUrl);
      messageApi.success('作业文档已删除');
      await loadTasks();
    } catch {
      messageApi.error('作业文档删除失败');
    }
  }

  async function deleteTask(task: TaskWithAttachments) {
    try {
      await axios.delete(`/api/tasks/${task.id}`);
      messageApi.success('作业已删除');
      await loadTasks();
    } catch {
      messageApi.error('作业删除失败');
    }
  }

  const visible = tasks.filter((task) => task.title.toLowerCase().includes(keyword.trim().toLowerCase()));
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
                <div className="course-task-title"><Tag color="blue">作业</Tag><Title level={4}>{task.title}</Title></div>
                <Paragraph type="secondary">{task.description}</Paragraph>
                <Text type="secondary">截止时间：{task.deadline ? new Date(task.deadline).toLocaleString() : '不设截止时间'}</Text>
                {task.attachments?.length ? <div className="course-task-attachments">
                  {task.attachments.map((attachment) => (
                    <span className="course-task-attachment" key={attachment.downloadUrl}>
                      <Button type="link" size="small" icon={<DownloadOutlined />} href={attachment.downloadUrl}>{attachment.fileName}</Button>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`删除 ${attachment.fileName}`} onClick={() => void deleteAttachment(task, attachment)} />
                    </span>
                  ))}
                </div> : null}
              </div>
              <div className="course-task-actions">
                <Tag color={statusMeta[task.status].color}>{statusMeta[task.status].label}</Tag>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openTaskModal(task)}>编辑</Button>
                <Popconfirm title="确定删除该作业？" onConfirm={() => void deleteTask(task)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
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
          <Form.Item name="description" label="作业说明" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="deadline" label="截止时间"><DatePicker showTime className="full-width" /></Form.Item>
          <Form.Item label="作业文档">
            <Upload
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
              multiple
              showUploadList={false}
              beforeUpload={(file) => {
                setAttachmentFiles((files) => [...files, { uid: file.uid, file }]);
                return false;
              }}
              onRemove={(file) => setAttachmentFiles((files) => files.filter((attachment) => attachment.uid !== file.uid))}
            >
              <Button icon={<UploadOutlined />}>选择文档</Button>
            </Upload>
            {attachmentFiles.length ? <div className="task-modal-attachments">
              {attachmentFiles.map((attachment) => (
                <div className="task-modal-attachment" key={attachment.uid}>
                  <span>{attachment.file.name}</span>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`移除 ${attachment.file.name}`} onClick={() => setAttachmentFiles((files) => files.filter((item) => item.uid !== attachment.uid))} />
                </div>
              ))}
            </div> : null}
            {editingTask && (editingTask as TaskWithAttachments).attachments?.map((attachment) => (
              <div className="task-modal-attachment task-modal-uploaded-attachment" key={attachment.downloadUrl}>
                <Button type="link" size="small" icon={<DownloadOutlined />} href={attachment.downloadUrl}>{attachment.fileName}</Button>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => void deleteAttachment(editingTask as TaskWithAttachments, attachment)} />
              </div>
            ))}
          </Form.Item>
          <Form.Item name="status" label="状态"><Select options={Object.entries(statusMeta).map(([value, item]) => ({ value, label: item.label }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
