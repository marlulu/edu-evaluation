import {
  AppstoreOutlined,
  BellOutlined,
  BookOutlined,
  CloseOutlined,
  FileAddOutlined,
  LogoutOutlined,
  MenuOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Avatar, Badge, Button, Card, Drawer, Empty, Menu, Modal, Popover, Space, Tag, Typography, message } from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
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

type SiteSettings = { footer_text?: string; icp_filing?: string };

export default function App() {
  void profiles;
  const [apiMessage, contextHolder] = message.useMessage();
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | undefined>();
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [activeModule, setActiveModule] = useState<ModuleKey>(() => {
    const saved = localStorage.getItem(MODULE_KEY);
    if (saved && ['dashboard', 'teaching', 'config', 'student', 'students'].includes(saved)) {
      return saved as ModuleKey;
    }
    return 'dashboard';
  });
  const [activeGroup, setActiveGroup] = useState<NavigationGroup>(() => {
    const saved = localStorage.getItem(MODULE_KEY);
    if (saved && ['dashboard', 'teaching', 'config', 'student', 'students'].includes(saved)) {
      return moduleMeta[saved as ModuleKey].group;
    }
    return 'overview';
  });

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) {
      return;
    }
    void fetchCurrentSession()
      .then((current) => setSessionUser({ ...current, accessToken: stored.accessToken }))
      .catch(() => clearSession());
  }, []);

  const refreshSiteSettings = useCallback(() => {
    axios.get<SiteSettings>('/api/site/settings')
      .then((res) => setSiteSettings(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => { refreshSiteSettings(); }, [refreshSiteSettings]);

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
              onSettingsSaved={refreshSiteSettings}
            />
          ) : (
            <PublicCanvas onLogin={() => setLoginOpen(true)} />
          )}
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          {siteSettings.footer_text && <span>{siteSettings.footer_text}</span>}
          {siteSettings.icp_filing && (
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{siteSettings.icp_filing}</a>
          )}
        </div>
      </footer>

      <Modal
        open={loginOpen}
        footer={null}
        width={420}
        centered
        destroyOnHidden
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

        <Space size={6} className="utility-actions">
          <Button type="text" shape="circle" icon={<QuestionCircleOutlined />} aria-label="帮助" />
          {authenticated && sessionUser && (sessionUser.role === 'TEACHER' || sessionUser.role === 'ASSISTANT' || sessionUser.role === 'ADMIN') && <AnalysisQueueBell />}
          {authenticated && sessionUser && sessionUser.role === 'STUDENT' && <StudentNotificationBell />}
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
  onSelect,
  onSettingsSaved
}: {
  activeModule: ModuleKey;
  user: SessionUser;
  visibleModules: ModuleKey[];
  onSelect: (module: ModuleKey) => void;
  onSettingsSaved: () => void;
}) {
  if (activeModule === 'teaching') {
    return <TeachingManagement />;
  }
  if (activeModule === 'config') {
    return <SystemConfig onSettingsSaved={onSettingsSaved} />;
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

type AnalysisTask = {
  taskId: string;
  fileName: string;
  status: string;
  progress: number;
};

const RUNNING_STATUSES = new Set(['queued', 'extracting', 'running', 'transcribing']);

function AnalysisQueueBell() {
  const [tasks, setTasks] = useState<AnalysisTask[]>([]);
  const [open, setOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const response = await axios.get<{ tasks: AnalysisTask[] }>('/api/analysis/tasks');
      setTasks(response.data.tasks ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void loadTasks();
    const timer = window.setInterval(loadTasks, 15000);
    return () => window.clearInterval(timer);
  }, [loadTasks]);

  const running = tasks.filter((t) => RUNNING_STATUSES.has(t.status));
  const recentlyDone = tasks.filter((t) => t.status === 'completed' || t.status === 'failed');
  const unreadCount = running.length;

  const content = (
    <div className="notification-popover">
      <div className="notification-header">
        <Text strong>分析队列</Text>
        <Button type="link" size="small" onClick={() => void loadTasks()}>刷新</Button>
      </div>
      {tasks.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分析任务" />}
      {running.length > 0 && (
        <div className="notification-section">
          <Text type="secondary" className="notification-section-title">进行中（{running.length}）</Text>
          {running.map((task) => (
            <div key={task.taskId} className="notification-item">
              <div className="notification-item-info">
                <Text ellipsis className="notification-item-name">{task.fileName}</Text>
                <Tag color="processing" className="notification-item-status">{task.status}</Tag>
              </div>
              <div className="notification-item-progress" style={{ width: `${Math.round(task.progress * 100)}%` }} />
            </div>
          ))}
        </div>
      )}
      {recentlyDone.length > 0 && (
        <div className="notification-section">
          <Text type="secondary" className="notification-section-title">最近完成</Text>
          {recentlyDone.slice(0, 5).map((task) => (
            <div key={task.taskId} className="notification-item">
              <Text ellipsis className="notification-item-name">{task.fileName}</Text>
              <Tag color={task.status === 'completed' ? 'success' : 'error'}>{task.status === 'completed' ? '完成' : '失败'}</Tag>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="bottomRight" overlayClassName="notification-popover-overlay">
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button type="text" shape="circle" icon={<BellOutlined />} aria-label="分析队列" />
      </Badge>
    </Popover>
  );
}

type Notification = {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedId: string | null;
  read: boolean;
  createdAt: string;
};

function StudentNotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        axios.get<Notification[]>('/api/notifications'),
        axios.get<{ count: number }>('/api/notifications/count')
      ]);
      setNotifications(listRes.data);
      setUnreadCount(countRes.data.count);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  async function markRead(id: string) {
    try {
      await axios.post(`/api/notifications/${id}/read`);
      void loadNotifications();
    } catch {
      // silent
    }
  }

  async function markAllRead() {
    try {
      await axios.post('/api/notifications/read-all');
      void loadNotifications();
    } catch {
      // silent
    }
  }

  const content = (
    <div className="notification-popover">
      <div className="notification-header">
        <Text strong>消息通知</Text>
        {unreadCount > 0 && <Button type="link" size="small" onClick={() => void markAllRead()}>全部已读</Button>}
      </div>
      {notifications.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" />}
      {notifications.length > 0 && (
        <div className="notification-section">
          {notifications.map((n) => (
            <div key={n.id} className={`notification-item student-notification${n.read ? '' : ' unread'}`} onClick={() => { if (!n.read) void markRead(n.id); }}>
              <div className="student-notification-content">
                <Text strong className="student-notification-title">{n.title}</Text>
                <Text type="secondary" className="student-notification-body">{n.content}</Text>
                <Text type="secondary" className="student-notification-time">{new Date(n.createdAt).toLocaleString()}</Text>
              </div>
              {!n.read && <div className="student-notification-dot" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="bottomRight" overlayClassName="notification-popover-overlay">
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button type="text" shape="circle" icon={<BellOutlined />} aria-label="消息通知" />
      </Badge>
    </Popover>
  );
}
