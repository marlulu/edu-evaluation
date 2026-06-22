import {
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Button, Card, Col, Form, Input, Row, Space, Tag, Typography } from 'antd';

const { Paragraph, Text, Title } = Typography;

export type UserRole = 'ADMIN' | 'TEACHER' | 'ASSISTANT' | 'STUDENT';

export type LoginProfile = {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  studentNo?: string;
};

type LoginPageProps = {
  onLogin: (values: { username: string; password: string }) => Promise<void> | void;
  loading: boolean;
  profiles: LoginProfile[];
};

const roleLabel: Record<UserRole, string> = {
  ADMIN: '管理员',
  TEACHER: '教师',
  ASSISTANT: '助教',
  STUDENT: '学生'
};

export function LoginPage({ onLogin, loading, profiles }: LoginPageProps) {
  const [form] = Form.useForm<{ username: string; password: string }>();

  function fillProfile(profile: LoginProfile) {
    form.setFieldsValue({ username: profile.username, password: profile.password });
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-hero">
          <Tag color="processing">Coursework Evaluation</Tag>
          <Title level={1} className="login-title">
            人工智能课程作业评价系统
          </Title>
          <Paragraph className="login-copy">
            统一管理作业提交、自动评分、结果反馈与系统配置。登录后按角色显示对应工作区。
          </Paragraph>
          <Row gutter={[12, 12]}>
            {profiles.map((profile) => (
              <Col xs={24} sm={12} key={profile.username}>
                <Card hoverable className="account-card" onClick={() => fillProfile(profile)}>
                  <Space direction="vertical" size={6}>
                    <Text strong>{profile.displayName}</Text>
                    <Text type="secondary">{profile.username}</Text>
                    <Tag>{roleLabel[profile.role]}</Tag>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        <Card className="login-card" bordered={false}>
          <Space direction="vertical" size={20} className="content-stack">
            <div>
              <Title level={3}>登录</Title>
              <Paragraph type="secondary">
                使用预置演示账号进入对应角色工作台。当前版本不接真实认证服务。
              </Paragraph>
            </div>

            <Form form={form} layout="vertical" onFinish={onLogin} initialValues={{ username: 'teacher01', password: 'teacher123' }}>
              <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
                <Input prefix={<UserOutlined />} placeholder="请输入账号" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={loading} icon={<SafetyCertificateOutlined />}>
                登录系统
              </Button>
            </Form>
          </Space>
        </Card>
      </div>
    </div>
  );
}
