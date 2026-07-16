import { CalendarOutlined, CheckCircleFilled, ClockCircleOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Space, Tag, Typography, Upload, message } from 'antd';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

const { Paragraph, Text, Title } = Typography;

type StudentWorkspaceProps = { studentName: string };
type Task = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  deadline: string | null;
  submitted: boolean;
  fileName: string | null;
  submittedAt: string | null;
  attachments: Array<{ fileName: string; downloadUrl: string }>;
  submissionRule: {
    allowedExtensions: string[];
    maxFileSizeBytes: number;
    ruleText: string | null;
  };
};

function taskIsClosed(task: Task) {
  return task.deadline !== null && new Date(task.deadline).getTime() <= Date.now();
}

export function StudentWorkspace({ studentName }: StudentWorkspaceProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<Task[]>('/api/student/tasks');
      setTasks(response.data);
    } catch {
      messageApi.error('任务加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function submit(task: Task, file: File) {
    const extension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase() ?? ''}` : '';
    if (task.submissionRule.allowedExtensions.length && !task.submissionRule.allowedExtensions.includes(extension)) {
      messageApi.error(`文件类型不符合要求：仅支持 ${task.submissionRule.allowedExtensions.join('、')}`);
      return;
    }
    if (file.size > task.submissionRule.maxFileSizeBytes) {
      messageApi.error(`文件超过最大限制（${Math.ceil(task.submissionRule.maxFileSizeBytes / 1024 / 1024)} MB）`);
      return;
    }
    const body = new FormData();
    body.append('file', file);
    try {
      await axios.post(`/api/student/tasks/${task.id}/submission`, body);
      messageApi.success(task.submitted ? '已更新为最新提交作品' : '作品已提交');
      await loadTasks();
    } catch (error) {
      if (axios.isAxiosError(error) && typeof error.response?.data === 'object' && error.response.data !== null
        && 'message' in error.response.data && typeof error.response.data.message === 'string') {
        messageApi.error(error.response.data.message);
      } else {
        messageApi.error('提交失败，任务可能已截止');
      }
    }
  }

  return (
    <div className="student-workspace">
      {contextHolder}
      <section className="page-heading student-heading">
        <div>
          <Tag color="blue">学生工作区</Tag>
          <Title level={2}>我的任务</Title>
          <Paragraph type="secondary">{studentName}，请在截止前提交或更新你的作品。</Paragraph>
        </div>
        <div className="student-summary"><Text type="secondary">待提交任务</Text><strong>{tasks.filter((task) => !task.submitted && !taskIsClosed(task)).length}</strong></div>
      </section>
      <section className="student-task-grid">
        {!loading && tasks.length === 0 && <Empty description="暂无可提交任务" />}
        {tasks.map((task) => {
          const closed = taskIsClosed(task);
          const status = closed ? { label: '已截止', color: 'default', icon: <ClockCircleOutlined /> }
            : task.submitted ? { label: '已提交', color: 'green', icon: <CheckCircleFilled /> }
              : { label: '待提交', color: 'blue', icon: <ClockCircleOutlined /> };
          return (
            <Card key={task.id} className="student-task-card" loading={loading}>
              <Space direction="vertical" size={16} className="content-stack">
                <Tag color={status.color} icon={status.icon}>{status.label}</Tag>
                <div><Title level={4}>{task.title}</Title><Paragraph type="secondary">{task.description}</Paragraph></div>
                <div className="task-deadline"><CalendarOutlined /><Text type="secondary">{task.deadline ? `截止：${new Date(task.deadline).toLocaleString()}` : '不设截止时间'}</Text></div>
                {task.attachments.map((attachment) => (
                  <Button key={attachment.downloadUrl} type="link" icon={<DownloadOutlined />} href={attachment.downloadUrl}>
                    {attachment.fileName}
                  </Button>
                ))}
                {task.submitted && <Text type="secondary">当前作品：{task.fileName}</Text>}
                <Text type="secondary">
                  {task.submissionRule.allowedExtensions.length
                    ? `允许：${task.submissionRule.allowedExtensions.join('、')}，`
                    : '未限制文件类型，'}
                  最大 {Math.ceil(task.submissionRule.maxFileSizeBytes / 1024 / 1024)} MB
                </Text>
                <Upload beforeUpload={(file) => { void submit(task, file); return false; }} showUploadList={false} disabled={closed}>
                  <Button type="primary" block icon={<UploadOutlined />} disabled={closed}>{task.submitted ? '重新提交作品' : '提交作品'}</Button>
                </Upload>
              </Space>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
