import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, Space, Typography } from 'antd';
import type { UserRole } from './api';

const { Paragraph, Title } = Typography;

export type LoginProfile = {
  id?: string;
  username: string;
  displayName: string;
  role: UserRole;
  studentId?: string | null;
};
export type { UserRole } from './api';

type LoginPageProps = {
  onLogin: (values: { username: string; password: string }) => Promise<void> | void;
  loading: boolean;
};

export function LoginPage({ onLogin, loading }: LoginPageProps) {
  return (
    <div className="login-form-panel">
      <Space direction="vertical" size={8} className="content-stack">
        <div>
          <Title level={3}>登录系统</Title>
          <Paragraph type="secondary">
            输入账号和密码进入对应的教学评价工作区。
          </Paragraph>
        </div>

        <Form
          layout="vertical"
          onFinish={onLogin}
          initialValues={{ username: 'teacher01', password: 'teacher123' }}
          requiredMark={false}
        >
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserOutlined />} placeholder="请输入账号" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading} icon={<SafetyCertificateOutlined />}>
            登录
          </Button>
        </Form>
      </Space>
    </div>
  );
}
