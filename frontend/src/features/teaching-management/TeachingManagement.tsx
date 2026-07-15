import { ArrowLeftOutlined, MoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Input, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import CourseManagement from './CourseManagement';

const { Paragraph, Text, Title } = Typography;

type CourseDetail = {
  id: string;
  name: string;
};

const taskPreview = [
  { title: '课程结业实践作品 - AIGC 创意作品', summary: '选择一个赛道完成课程实践作品，并在截止时间前提交。', deadline: '2026.06.30 12:04', status: '已结束', submitted: 81, pending: 0, overdue: 0 },
  { title: '第 2 章 机器学习习题', summary: '完成章节练习与课堂讨论要求。', deadline: '2026.06.25 12:05', status: '已结束', submitted: 81, pending: 0, overdue: 0 },
  { title: '第 1 章 绪论习题', summary: '完成课程导学与基础概念练习。', deadline: '2026.06.25 12:07', status: '已结束', submitted: 81, pending: 0, overdue: 0 },
  { title: '第 3 章 人工神经网络习题', summary: '根据课堂要求完成练习并提交答案。', deadline: '2026.07.08 20:00', status: '进行中', submitted: 56, pending: 22, overdue: 3 }
];

const TeachingManagement = () => {
  const [course, setCourse] = useState<CourseDetail | undefined>();

  if (course) {
    return <CourseTasks course={course} onBack={() => setCourse(undefined)} />;
  }

  return (
    <div className="teaching-management">
      <div className="teaching-management-heading">
        <Title level={3}>课程管理</Title>
      </div>
      <CourseManagement onViewTasks={(id, name) => setCourse({ id, name })} />
    </div>
  );
};

function CourseTasks({ course, onBack }: { course: CourseDetail; onBack: () => void }) {
  return (
    <div className="course-tasks-page">
      <section className="course-detail-heading">
        <div>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>返回课程</Button>
          <Title level={2}>{course.name}</Title>
          <Text type="secondary">课程作业与测验</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}>新建作业</Button>
      </section>

      <Card className="course-task-list">
        <div className="course-task-filters">
          <Space wrap>
            <Button type="primary" ghost>全部</Button>
            <Button type="text">未发布</Button>
            <Button type="text">进行中</Button>
            <Button type="text">已结束</Button>
          </Space>
          <Space wrap>
            <Button type="text">选择班级</Button>
            <Input prefix={<SearchOutlined />} placeholder="请输入关键词" className="course-task-search" />
          </Space>
        </div>
        <div className="course-task-items">
          {taskPreview.map((task) => (
            <article className="course-task-item" key={task.title}>
              <div className="course-task-main">
                <div className="course-task-title">
                  <Tag color="blue">作业</Tag>
                  <Title level={4}>{task.title}</Title>
                </div>
                <Paragraph type="secondary">{task.summary}</Paragraph>
                <Space size={18}>
                  <Text type="secondary">截止时间：{task.deadline}</Text>
                  <Text type="secondary">0 条评论</Text>
                </Space>
              </div>
              <div className="course-task-side">
                <Space>
                  <Tag color={task.status === '进行中' ? 'green' : 'default'}>{task.status}</Tag>
                  <Button type="text" shape="circle" icon={<MoreOutlined />} />
                </Space>
                <div className="task-statistics">
                  <span>已交 <strong>{task.submitted}</strong></span>
                  <span>未批 <strong>{task.pending}</strong></span>
                  <span>未交 <strong>{task.overdue}</strong></span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default TeachingManagement;
