import {
  AppstoreOutlined,
  BellOutlined,
  BookOutlined,
  CloseOutlined,
  FileAddOutlined,
  LogoutOutlined,
  MenuOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Avatar, Button, Card, Drawer, Input, Menu, Modal, Space, Tag, Typography, message } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { LoginPage, type UserRole } from './features/auth/LoginPage';
import {
  clearSession,
  fetchCurrentSession,
  getStoredSession,
  login,
  registerStudent,
  registerTeacher,
  persistSession,
  type AuthSession
} from './features/auth/api';
import { SystemConfig } from './features/system-config/SystemConfig';
import { StudentWorkspace } from './features/student-workspace/StudentWorkspace';
import { StudentManagement } from './features/student-management/StudentManagement';
import TeachingManagement from './features/teaching-management/TeachingManagement';

const { Paragraph, Text, Title } = Typography;

type SessionUser = AuthSession;
type ModuleKey = 'dashboard' | 'teaching' | 'config' | 'student' | 'students';
type NavigationGroup = 'overview' | 'teaching' | 'system';

const MODULE_KEY = 'edu-evaluation-active-module';

const profiles: Array<Record<string, string>> = [
  { username: 'admin', password: 'admin123', displayName: '系统管理员', role: 'ADMIN' },
  { username: 'teacher01', password: 'teacher123', displayName: '课程教师', role: 'TEACHER' },
  { username: 'assistant01', password: 'assistant123', displayName: '教师助理', role: 'ASSISTANT' },
  {
    username: 'student01',
    password: 'student123',
    displayName: '学生',
    role: 'STUDENT',
    studentId: 'demo-student-001'
  }
];

const roleLabel: Record<UserRole, string> = {
  ADMIN: '管理员',
  TEACHER: '教师',
  ASSISTANT: '助教',
  STUDENT: '学生'
};

const roleModules: Record<UserRole, ModuleKey[]> = {
  ADMIN: ['config'],
  TEACHER: ['dashboard', 'teaching', 'students'],
  ASSISTANT: ['dashboard', 'teaching', 'students'],
  STUDENT: ['student']
};

const moduleMeta: Record<
  ModuleKey,
  { label: string; icon: ReactNode; description: string; group: NavigationGroup }
> = {
  dashboard: {
    label: '工作台',
    icon: <AppstoreOutlined />,
    description: '查看当前角色的工作入口和待处理事项。',
    group: 'overview'
  },
  teaching: {
    label: '课程管理',
    icon: <BookOutlined />,
    description: '管理课程、课程成员和课程任务。',
    group: 'teaching'
  },
  config: {
    label: '系统配置',
    icon: <SettingOutlined />,
    description: '管理模型配置与系统参数。',
    group: 'system'
  },
  student: {
    label: '我的任务',
    icon: <FileAddOutlined />,
    description: '查看关联任务并提交课程作业。',
    group: 'overview'
  },
  students: {
    label: '学生管理',
    icon: <TeamOutlined />,
    description: '维护学生信息、自定义组别和导入名单。',
    group: 'teaching'
  }
};

const navigationMeta: Record<NavigationGroup, string> = {
  overview: '首页',
  teaching: '教学管理',
  system: '系统管理'
};

export default function App() {
  void profiles;
  const [apiMessage, contextHolder] = message.useMessage();
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | undefined>();
  const [activeModule, setActiveModule] = useState<ModuleKey>(() => {
    const saved = localStorage.getItem(MODULE_KEY);
    if (saved && ['dashboard', 'teaching', 'config', 'student', 'students'].includes(saved)) {
      return saved as ModuleKey;
    }
    return 'dashboard';
  });
  const [activeGroup, setActiveGroup] = useState<NavigationGroup>('overview');

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) {
      return;
    }
    void fetchCurrentSession()
      .then((current) => setSessionUser({ ...current, accessToken: stored.accessToken }))
      .catch(() => clearSession());
  }, []);

  const visibleModules = useMemo(
    () => (sessionUser ? roleModules[sessionUser.role] : []),
    [sessionUser]
  );

  const visibleGroups = useMemo(
    () =>
      (Object.keys(navigationMeta) as NavigationGroup[]).filter((group) =>
        visibleModules.some((module) => moduleMeta[module].group === group)
      ),
    [visibleModules]
  );

  const groupModules = useMemo(
    () => visibleModules.filter((module) => moduleMeta[module].group === activeGroup),
    [activeGroup, visibleModules]
  );

  useEffect(() => {
    if (!visibleModules.includes(activeModule) && visibleModules.length > 0) {
      setActiveModule(visibleModules[0]);
    }
  }, [activeModule, visibleModules]);

  useEffect(() => {
    if (sessionUser) {
      setActiveGroup(moduleMeta[activeModule].group);
      localStorage.setItem(MODULE_KEY, activeModule);
    }
  }, [activeModule, sessionUser]);

  async function handleLogin(values: { username: string; password: string }) {
    setLoginLoading(true);
    try {
      const matched = await login(values.username.trim(), values.password);
      if (!matched.accessToken) {
        apiMessage.error('账号或密码不正确');
        return;
      }
      setSessionUser(matched);
      setActiveModule(roleModules[matched.role][0] ?? 'dashboard');
      persistSession(matched);
      setLoginOpen(false);
      apiMessage.success(`欢迎回来，${matched.displayName}`);
    } catch {
      apiMessage.error('登录失败，请检查账号密码或后端服务状态');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(values: {
    role: 'TEACHER' | 'STUDENT';
    username: string;
    password: string;
    displayName?: string;
    studentNumber?: string;
    initialPassword?: string;
  }) {
    setLoginLoading(true);
    try {
      const session = values.role === 'TEACHER'
        ? await registerTeacher({ username: values.username, password: values.password, displayName: values.displayName ?? '' })
        : await registerStudent({
          username: values.username,
          password: values.password,
          studentNumber: values.studentNumber ?? '',
          initialPassword: values.initialPassword ?? ''
        });
      setSessionUser(session);
      persistSession(session);
      setActiveModule(roleModules[session.role][0] ?? 'dashboard');
      setLoginOpen(false);
      apiMessage.success('注册成功');
    } catch {
      apiMessage.error('注册失败，请检查填写信息');
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    setSessionUser(undefined);
    setActiveModule('dashboard');
    setActiveGroup('overview');
  }

  function selectGroup(group: NavigationGroup) {
    setActiveGroup(group);
    const nextModule = visibleModules.find((module) => moduleMeta[module].group === group);
    if (nextModule) {
      setActiveModule(nextModule);
    }
  }

  return (
    <div className="app-shell">
      {contextHolder}
      <GlobalHeader
        authenticated={Boolean(sessionUser)}
        sessionUser={sessionUser}
        activeGroup={activeGroup}
        visibleGroups={visibleGroups}
        visibleModules={visibleModules}
        groupModules={groupModules}
        activeModule={activeModule}
        onLogin={() => setLoginOpen(true)}
        onLogout={handleLogout}
        onSelectGroup={selectGroup}
        onSelectModule={setActiveModule}
        mobileNavigationOpen={mobileNavigationOpen}
        onOpenMobileNavigation={() => setMobileNavigationOpen(true)}
        onCloseMobileNavigation={() => setMobileNavigationOpen(false)}
      />

      <main className="app-main">
        <div className="page-canvas">
          {sessionUser ? (
            <AuthenticatedContent
              activeModule={activeModule}
              user={sessionUser}
              visibleModules={visibleModules}
              onSelect={setActiveModule}
            />
          ) : (
            <PublicCanvas onLogin={() => setLoginOpen(true)} />
          )}
        </div>
      </main>

      <Modal
        open={loginOpen}
        footer={null}
        width={420}
        centered
        destroyOnClose
        onCancel={() => setLoginOpen(false)}
        className="login-modal"
      >
        <LoginPage onLogin={handleLogin} onRegister={handleRegister} loading={loginLoading} />
      </Modal>
    </div>
  );
}

function GlobalHeader({
  authenticated,
  sessionUser,
  activeGroup,
  visibleGroups,
  visibleModules,
  groupModules,
  activeModule,
  onLogin,
  onLogout,
  onSelectGroup,
  onSelectModule,
  mobileNavigationOpen,
  onOpenMobileNavigation,
  onCloseMobileNavigation
}: {
  authenticated: boolean;
  sessionUser: SessionUser | undefined;
  activeGroup: NavigationGroup;
  visibleGroups: NavigationGroup[];
  visibleModules: ModuleKey[];
  groupModules: ModuleKey[];
  activeModule: ModuleKey;
  onLogin: () => void;
  onLogout: () => void;
  onSelectGroup: (group: NavigationGroup) => void;
  onSelectModule: (module: ModuleKey) => void;
  mobileNavigationOpen: boolean;
  onOpenMobileNavigation: () => void;
  onCloseMobileNavigation: () => void;
}) {
  const groups = visibleGroups;

  return (
    <header className="global-header">
      <div className="utility-bar">
        {authenticated && (
          <Button
            type="text"
            shape="circle"
            className="mobile-nav-trigger"
            icon={<MenuOutlined />}
            aria-label="打开导航"
            onClick={onOpenMobileNavigation}
          />
        )}
        <div className="brand-mark" aria-label="AI 课程作业评价系统">
          <span className="brand-bars" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>智评课堂</strong>
            <small>AI COURSEWORK</small>
          </span>
        </div>

        <Button type="text" className="channel-button">
          全部频道
        </Button>

        <Input
          className="global-search"
          aria-label="全局搜索"
          placeholder="搜索课程、任务或学生"
          prefix={<SearchOutlined />}
          readOnly
        />

        <Space size={6} className="utility-actions">
          <Button type="text" shape="circle" icon={<QuestionCircleOutlined />} aria-label="帮助" />
          <Button type="text" shape="circle" icon={<BellOutlined />} aria-label="通知" />
          {authenticated && sessionUser ? (
            <>
              <Tag color="blue" className="role-tag">
                {roleLabel[sessionUser.role]}
              </Tag>
              <Button type="text" className="account-button" onClick={onLogout}>
                <Avatar size={30} icon={<UserOutlined />} />
                <span className="account-name">{sessionUser.displayName}</span>
                <LogoutOutlined />
              </Button>
            </>
          ) : (
            <Button type="text" className="account-button" onClick={onLogin}>
              <Avatar size={30} icon={<UserOutlined />} />
              <span className="account-name">登录</span>
            </Button>
          )}
        </Space>
      </div>

      {authenticated && (
        <div className="navigation-band">
          <nav className="primary-navigation" aria-label="主导航">
            {groups.map((group) => (
              <Button
                key={group}
                type="text"
                className={group === activeGroup ? 'nav-button nav-button-active' : 'nav-button'}
                onClick={() => onSelectGroup(group)}
              >
                {navigationMeta[group]}
              </Button>
            ))}
          </nav>

          {groupModules.length > 0 && (
          <Menu
            mode="horizontal"
            selectedKeys={[activeModule]}
            className="context-navigation"
            items={groupModules.map((module) => ({
              key: module,
              icon: moduleMeta[module].icon,
              label: moduleMeta[module].label
            }))}
            onClick={({ key }) => onSelectModule(key as ModuleKey)}
          />
          )}
        </div>
      )}

      {authenticated && (
        <Drawer
        placement="left"
        width={280}
        open={mobileNavigationOpen}
        closable={false}
        className="mobile-navigation-drawer"
        onClose={onCloseMobileNavigation}
        title={
          <div className="drawer-title">
            <span>导航</span>
            <Button
              type="text"
              shape="circle"
              icon={<CloseOutlined />}
              aria-label="关闭导航"
              onClick={onCloseMobileNavigation}
            />
          </div>
        }
      >
        <Menu
          mode="inline"
          selectedKeys={authenticated ? [activeModule] : [activeGroup]}
          items={
            authenticated
              ? groups.flatMap((group) =>
                  visibleModules
                    .filter((module) => moduleMeta[module].group === group)
                    .map((module) => ({
                    key: module,
                    icon: moduleMeta[module].icon,
                    label: moduleMeta[module].label
                    }))
                )
              : groups.map((group) => ({ key: group, label: navigationMeta[group] }))
          }
          onClick={({ key }) => {
            if (authenticated) {
              onSelectModule(key as ModuleKey);
            }
            onCloseMobileNavigation();
          }}
        />
        </Drawer>
      )}
    </header>
  );
}

function PublicCanvas({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="public-canvas">
      <section className="public-intro">
        <Tag color="blue">教学评价平台</Tag>
        <Title>让课程作业评价更清晰、更高效</Title>
        <Paragraph>
          面向课程教学的统一工作空间。任务组织、作品分析与结果反馈将在这里形成连贯的工作流。
        </Paragraph>
        <Button type="primary" size="large" onClick={onLogin}>
          登录进入系统
        </Button>
      </section>

      <section className="public-grid" aria-label="平台能力概览">
        {[
          ['课程任务', '围绕教学节奏组织任务与提交。'],
          ['结果反馈', '让教师和学生清晰掌握评价进度。']
        ].map(([title, description]) => (
          <Card key={title} className="overview-card">
            <Title level={4}>{title}</Title>
            <Text type="secondary">{description}</Text>
          </Card>
        ))}
      </section>
    </div>
  );
}

function AuthenticatedContent({
  activeModule,
  user,
  visibleModules,
  onSelect
}: {
  activeModule: ModuleKey;
  user: SessionUser;
  visibleModules: ModuleKey[];
  onSelect: (module: ModuleKey) => void;
}) {
  if (activeModule === 'teaching') {
    return <TeachingManagement />;
  }
  if (activeModule === 'config') {
    return <SystemConfig />;
  }
  if (activeModule === 'student') {
    return <StudentWorkspace studentName={user.displayName} />;
  }
  if (activeModule === 'students') {
    return <StudentManagement />;
  }

  return <Dashboard user={user} visibleModules={visibleModules} onSelect={onSelect} />;
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
      <section className="page-heading">
        <div>
          <Tag color="blue">{roleLabel[user.role]}</Tag>
          <Title level={2}>欢迎回来，{user.displayName}</Title>
          <Paragraph type="secondary">从下方入口继续处理课程任务和评价工作。</Paragraph>
        </div>
      </section>

      <div className="dashboard-grid">
        {visibleModules
          .filter((module) => module !== 'dashboard')
          .map((module) => (
            <Card key={module} hoverable className="dashboard-card" onClick={() => onSelect(module)}>
              <Space direction="vertical" size={10}>
                <span className="card-icon">{moduleMeta[module].icon}</span>
                <Title level={4}>{moduleMeta[module].label}</Title>
                <Text type="secondary">{moduleMeta[module].description}</Text>
              </Space>
            </Card>
          ))}
      </div>
    </Space>
  );
}
