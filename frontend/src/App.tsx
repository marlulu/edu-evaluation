import {
  BookOutlined,
  FileOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Avatar, Button, Card, Layout, Menu, Space, Tag, Typography, message } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { LoginPage, type LoginProfile, type UserRole } from './features/auth/LoginPage';
import { WorkAnalysis } from './features/work-analysis/WorkAnalysis';
import { ClassManagement } from './features/class-management/ClassManagement';

const { Header, Sider, Content } = Layout;
const { Paragraph, Text, Title } = Typography;

type SessionUser = LoginProfile;
type ModuleKey = 'dashboard' | 'work' | 'class';

const SESSION_KEY = 'edu-evaluation-session';

const profiles: LoginProfile[] = [
  { username: 'admin', password: 'admin123', displayName: '系统管理员', role: 'ADMIN' },
  { username: 'teacher01', password: 'teacher123', displayName: '课程教师', role: 'TEACHER' },
];

const roleLabel: Record<UserRole, string> = {
  ADMIN: '管理员',
  TEACHER: '教师',
  ASSISTANT: '助教',
  STUDENT: '学生'
};

const roleModules: Record<UserRole, ModuleKey[]> = {
  ADMIN: ['dashboard', 'work', 'class'],
  TEACHER: ['dashboard', 'work', 'class'],
  ASSISTANT: ['dashboard', 'class'],
  STUDENT: ['dashboard']
};

const moduleMeta: Record<
  ModuleKey,
  { label: string; icon: ReactNode; description: string }
> = {
  dashboard: { label: '工作台', icon: <BookOutlined />, description: '查看当前角色下的工作入口和模块概览。' },
  work: { label: '作品分析', icon: <FileOutlined />, description: '上传作品进行元数据提取、语音识别、内容分析和评判标准评分。' },
  class: { label: '班级管理', icon: <TeamOutlined />, description: '管理班级和学生，查看学生作品分析结果。' }
};

export default function App() {
  const [apiMessage, contextHolder] = message.useMessage();
  const [loginLoading, setLoginLoading] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | undefined>();
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as SessionUser;
      setSessionUser(parsed);
      setActiveModule(roleModules[parsed.role][0] ?? 'dashboard');
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const visibleModules = useMemo(
    () => (sessionUser ? roleModules[sessionUser.role] : []),
    [sessionUser]
  );

  useEffect(() => {
    if (!visibleModules.includes(activeModule) && visibleModules.length > 0) {
      setActiveModule(visibleModules[0]);
    }
  }, [activeModule, visibleModules]);

  async function handleLogin(values: { username: string; password: string }) {
    setLoginLoading(true);
    try {
      const matched = profiles.find(
        (profile) =>
          profile.username === values.username.trim() &&
          profile.password === values.password
      );
      if (!matched) {
        apiMessage.error('账号或密码不正确');
        return;
      }
      setSessionUser(matched);
      setActiveModule(roleModules[matched.role][0] ?? 'dashboard');
      localStorage.setItem(SESSION_KEY, JSON.stringify(matched));
      apiMessage.success(`欢迎回来，${matched.displayName}`);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    setSessionUser(undefined);
    setActiveModule('dashboard');
  }

  if (!sessionUser) {
    return (
      <>
        {contextHolder}
        <LoginPage onLogin={handleLogin} loading={loginLoading} profiles={profiles} />
      </>
    );
  }

  return (
    <>
      {contextHolder}
      <Layout className="shell-layout">
        <Sider width={248} theme="light" className="shell-sider">
          <div className="brand-block">
            <Tag color="processing">AI Work</Tag>
            <Title level={4} className="brand-title">
              作品分析系统
            </Title>
            <Text type="secondary">上传作品进行智能分析</Text>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[activeModule]}
            items={visibleModules.map((moduleKey) => ({
              key: moduleKey,
              icon: moduleMeta[moduleKey].icon,
              label: moduleMeta[moduleKey].label
            }))}
            onClick={({ key }) => setActiveModule(key as ModuleKey)}
          />
        </Sider>
        <Layout>
          <Header className="shell-header">
            <div>
              <Title level={4} className="page-title">
                {moduleMeta[activeModule].label}
              </Title>
              <Text type="secondary">{moduleMeta[activeModule].description}</Text>
            </div>
            <Space size={16}>
              <Tag color="blue">{roleLabel[sessionUser.role]}</Tag>
              <Space>
                <Avatar icon={<UserOutlined />} />
                <div className="user-meta">
                  <Text strong>{sessionUser.displayName}</Text>
                  <Text type="secondary">{sessionUser.username}</Text>
                </div>
              </Space>
              <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                退出登录
              </Button>
            </Space>
          </Header>
          <Content className="shell-content">
            {activeModule === 'dashboard' && (
              <Dashboard user={sessionUser} visibleModules={visibleModules} onSelect={setActiveModule} />
            )}
            {activeModule === 'work' && <WorkAnalysis />}
            {activeModule === 'class' && <ClassManagement />}
          </Content>
        </Layout>
      </Layout>
    </>
  );
}

function Dashboard({
  user,
  visibleModules,
  onSelect
}: {
  user: SessionUser;
  visibleModules: ModuleKey[];
  onSelect: (module: ModuleKey) => void;
}) {
  return (
    <Space direction="vertical" size={20} className="content-stack">
      <Card className="hero-card">
        <Space direction="vertical" size={8}>
          <Tag color="processing">{roleLabel[user.role]}</Tag>
          <Title level={2} className="compact-title">
            {user.displayName}，欢迎进入工作台
          </Title>
          <Paragraph type="secondary" className="detail-paragraph">
            本系统专注于作品智能分析，支持作品上传、元数据提取、语音识别、内容分析和质量评估。
          </Paragraph>
        </Space>
      </Card>

      <div className="dashboard-grid">
        {visibleModules
          .filter((moduleKey) => moduleKey !== 'dashboard')
          .map((moduleKey) => (
            <Card
              key={moduleKey}
              hoverable
              className="dashboard-card"
              onClick={() => onSelect(moduleKey)}
            >
              <Space direction="vertical" size={10}>
                <span className="card-icon">{moduleMeta[moduleKey].icon}</span>
                <Title level={4} className="compact-title">
                  {moduleMeta[moduleKey].label}
                </Title>
                <Text type="secondary">{moduleMeta[moduleKey].description}</Text>
              </Space>
            </Card>
          ))}
      </div>
    </Space>
  );
}
