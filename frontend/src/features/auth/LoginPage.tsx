import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, Radio, Space, Typography } from 'antd';
import { useState } from 'react';
import type { UserRole } from './api';

const { Paragraph, Title } = Typography;
export type LoginProfile = { id?: string; username: string; displayName: string; role: UserRole; studentId?: string | null };
export type { UserRole } from './api';
type RegisterValues = { role: 'TEACHER' | 'STUDENT'; username: string; password: string; displayName?: string; studentNumber?: string; initialPassword?: string };
type LoginPageProps = {
  onLogin: (values: { username: string; password: string }) => Promise<void> | void;
  onRegister: (values: RegisterValues) => Promise<void> | void;
  loading: boolean;
};

export function LoginPage({ onLogin, onRegister, loading }: LoginPageProps) {
  const [registering, setRegistering] = useState(false);
  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>('TEACHER');
  return <div className="login-form-panel"><Space direction="vertical" size={8} className="content-stack">
    <div><Title level={3}>{registering ? '注册账号' : '登录系统'}</Title><Paragraph type="secondary">{registering ? '教师可直接注册；学生需使用导入时获得的学号与初始密码。' : '输入账号和密码进入对应的教学工作区。'}</Paragraph></div>
    {registering ? <Form layout="vertical" onFinish={onRegister} initialValues={{ role }} requiredMark={false}>
      <Form.Item name="role" label="身份"><Radio.Group onChange={(event) => setRole(event.target.value)}><Radio value="TEACHER">教师</Radio><Radio value="STUDENT">学生</Radio></Radio.Group></Form.Item>
      {role === 'TEACHER' && <Form.Item name="displayName" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>}
      {role === 'STUDENT' && <><Form.Item name="studentNumber" label="学号" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="initialPassword" label="初始密码" rules={[{ required: true }]}><Input.Password /></Form.Item></>}
      <Form.Item name="username" label="登录账号" rules={[{ required: true }]}><Input prefix={<UserOutlined />} /></Form.Item>
      <Form.Item name="password" label="登录密码" rules={[{ required: true }, { min: 8 }]}><Input.Password prefix={<LockOutlined />} /></Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>完成注册</Button>
    </Form> : <Form layout="vertical" onFinish={onLogin} initialValues={{ username: 'teacher01', password: 'teacher123' }} requiredMark={false}>
      <Form.Item name="username" label="账号" rules={[{ required: true }]}><Input prefix={<UserOutlined />} autoComplete="username" /></Form.Item>
      <Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password prefix={<LockOutlined />} autoComplete="current-password" /></Form.Item>
      <Button type="primary" htmlType="submit" block size="large" loading={loading} icon={<SafetyCertificateOutlined />}>登录</Button>
    </Form>}
    <Button type="link" onClick={() => setRegistering((value) => !value)}>{registering ? '已有账号，返回登录' : '注册新账号'}</Button>
  </Space></div>;
}
