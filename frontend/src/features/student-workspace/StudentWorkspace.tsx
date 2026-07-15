import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FileTextOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { Button, Card, Space, Tag, Tooltip, Typography } from 'antd';
import type { ReactNode } from 'react';

const { Paragraph, Text, Title } = Typography;

type StudentWorkspaceProps = {
  studentName: string;
};

type TaskPreview = {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: 'ready' | 'submitted' | 'closed';
};

const taskPreviews: TaskPreview[] = [
  {
    id: 'ready',
    title: '课程作业任务',
    description: '任务内容将在关联任务服务接入后显示。',
    deadline: '截止时间待加载',
    status: 'ready'
  },
  {
    id: 'submitted',
    title: '已提交任务',
    description: '当前提交状态将在任务服务接入后同步。',
    deadline: '提交时间待加载',
    status: 'submitted'
  },
  {
    id: 'closed',
    title: '已截止任务',
    description: '已截止任务仅保留提交状态，不能替换作品。',
    deadline: '截止时间待加载',
    status: 'closed'
  }
];

const statusMeta: Record<TaskPreview['status'], { label: string; color: string; icon: ReactNode }> = {
  ready: { label: '待提交', color: 'blue', icon: <ClockCircleOutlined /> },
  submitted: { label: '已提交', color: 'green', icon: <CheckCircleFilled /> },
  closed: { label: '已截止', color: 'default', icon: <ClockCircleOutlined /> }
};

export function StudentWorkspace({ studentName }: StudentWorkspaceProps) {
  return (
    <div className="student-workspace">
      <section className="page-heading student-heading">
        <div>
          <Tag color="blue">学生工作区</Tag>
          <Title level={2}>我的任务</Title>
          <Paragraph type="secondary">
            {studentName}，这里将展示分配给你的课程作业。
          </Paragraph>
        </div>
        <div className="student-summary">
          <Text type="secondary">待提交任务</Text>
          <strong>1</strong>
        </div>
      </section>

      <div className="student-filter-row" aria-label="任务状态">
        <Tag color="blue">全部任务</Tag>
        <Tag>待提交</Tag>
        <Tag>已提交</Tag>
        <Tag>已截止</Tag>
      </div>

      <section className="student-task-grid">
        {taskPreviews.map((task) => {
          const status = statusMeta[task.status];
          return (
            <Card key={task.id} className="student-task-card">
              <Space direction="vertical" size={16} className="content-stack">
                <div className="task-card-topline">
                  <Tag color={status.color} icon={status.icon}>
                    {status.label}
                  </Tag>
                  <FileTextOutlined className="task-file-icon" />
                </div>
                <div>
                  <Title level={4}>{task.title}</Title>
                  <Paragraph type="secondary">{task.description}</Paragraph>
                </div>
                <div className="task-deadline">
                  <CalendarOutlined />
                  <Text type="secondary">{task.deadline}</Text>
                </div>
                <Tooltip title="待任务服务接入后启用">
                  <Button
                    type="primary"
                    block
                    disabled
                    icon={<UploadOutlined />}
                  >
                    提交作品
                  </Button>
                </Tooltip>
              </Space>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
