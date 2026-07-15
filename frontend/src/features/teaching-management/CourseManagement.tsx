import { Button, Card, Input, Space, Table, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const { Title, Text } = Typography;

type Course = {
  id: string;
  name: string;
  description: string;
  studentCount: number;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
};

export default function CourseManagement({
  onViewTasks
}: {
  onViewTasks: (courseId: string, courseName: string) => void;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<Course[]>('/api/courses');
      setCourses(response.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const data = courses.filter((course) =>
    `${course.name} ${course.description}`.toLowerCase().includes(keyword.toLowerCase())
  );

  return (
    <Card>
      <Space direction="vertical" size={16} className="content-stack">
        <Space className="toolbar-row">
          <div>
            <Title level={4}>课程列表</Title>
            <Text type="secondary">管理课程、成员和课程任务</Text>
          </div>
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索课程" />
          <Button onClick={() => void loadCourses()}>刷新</Button>
        </Space>
        <Table<Course>
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={false}
          columns={[
            { title: '课程名称', dataIndex: 'name' },
            { title: '课程说明', dataIndex: 'description' },
            { title: '学生数', dataIndex: 'studentCount' },
            { title: '状态', dataIndex: 'status', render: (status: Course['status']) => <Tag>{status}</Tag> },
            {
              title: '操作',
              render: (_, course) => <Button type="link" onClick={() => onViewTasks(course.id, course.name)}>进入课程</Button>
            }
          ]}
        />
      </Space>
    </Card>
  );
}
