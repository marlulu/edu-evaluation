import { ArrowLeftOutlined, BookOutlined, BellOutlined, CloseOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, FileTextOutlined, PaperClipOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined, StopOutlined, TeamOutlined, UploadOutlined, UserAddOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Collapse, DatePicker, Descriptions, Dropdown, Empty, Form, Image, Input, InputNumber, Modal, Popconfirm, Progress, Select, Space, Spin, Steps, Table, Tabs, Tag, Timeline, Tooltip, Typography, Upload, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import CourseManagement from './CourseManagement';
import { saveNavState, loadNavState, clearNavState } from '../../navigation-state';
import { FilePreviewModal, isPreviewable, getPreviewCategory } from '../shared/FilePreviewModal';
import mammoth from 'mammoth';

const { Text, Title } = Typography;
async function downloadAuthenticatedFile(url: string, fileName: string, apiMessage: { error: (content: string) => void }) {
  try {
    const response = await axios.get<Blob>(url, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  } catch {
    apiMessage.error('文件下载失败');
  }
}
type CourseDetail = { id: string; name: string };
type TaskStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
type Attachment = { fileName: string; downloadUrl: string; deleteUrl: string };
type CourseAttachment = { id: string; fileName: string; downloadUrl: string };
type Task = { id: string; title: string; description: string; deadline: string | null; status: TaskStatus; createdAt: string; attachments: Attachment[] };
type TaskForm = { title: string; description: string; deadline?: dayjs.Dayjs; status: TaskStatus };
type SubmissionRule = {
  allowedExtensions: string[];
  maxFileSizeBytes: number;
  ruleText: string | null;
  scoringRuleText: string | null;
  importedFileName?: string | null;
  importedAt?: string | null;
  importedDownloadUrl?: string | null;
};
type RuleForm = { allowedExtensions: string[]; maxFileSizeMb: number; ruleText: string; scoringRuleText: string };
type Student = { id: string; number: string; name: string };
type StudentGroup = { id: string; name: string; studentCount: number };
type CourseOptions = { students?: Student[]; groups?: StudentGroup[] };
const extensionOptions = ['.pdf', '.docx', '.txt', '.md', '.zip', '.pptx', '.xlsx', '.jpg', '.png', '.mp3', '.mp4'];
const statusMeta: Record<TaskStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  ACTIVE: { label: '进行中', color: 'green' },
  CLOSED: { label: '已结束', color: 'orange' }
};

export default function TeachingManagement() {
  const [course, setCourse] = useState<CourseDetail | undefined>(() => loadNavState<CourseDetail | undefined>('teaching-course', undefined));

  useEffect(() => {
    if (course) saveNavState('teaching-course', course);
    else clearNavState('teaching-course');
  }, [course]);

  function handleBack() {
    setCourse(undefined);
    clearNavState('teaching-course');
    clearNavState('teaching-active-key');
    clearNavState('teaching-open-tasks');
    clearNavState('teaching-analysis');
  }

  return course ? <CourseDetailPage course={course} onBack={handleBack} /> : (
    <div className="teaching-management">
      <div className="teaching-management-heading"><Title level={3}>课程管理</Title></div>
      <CourseManagement onViewTasks={(id, name) => setCourse({ id, name })} />
    </div>
  );
}

function CourseDetailPage({ course, onBack }: { course: CourseDetail; onBack: () => void }) {
  const restoredAnalysis = loadNavState<{ student: Student; taskId?: string; jobId?: string } | undefined>('teaching-analysis', undefined);
  const [openTasks, setOpenTasks] = useState<Task[]>(() => loadNavState<Task[]>('teaching-open-tasks', []));
  const [analysisStudent, setAnalysisStudent] = useState<Student | undefined>(restoredAnalysis?.student);
  const [analysisTaskId, setAnalysisTaskId] = useState<string | undefined>(restoredAnalysis?.taskId);
  const [analysisJobId, setAnalysisJobId] = useState<string | undefined>(restoredAnalysis?.jobId);
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [activeKey, setActiveKey] = useState(() => loadNavState<string>('teaching-active-key', 'tasks'));
  const [messageApi, contextHolder] = message.useMessage();
  const tabsRestored = useRef(false);

  // Persist openTasks
  useEffect(() => {
    saveNavState('teaching-open-tasks', openTasks);
  }, [openTasks]);

  // Persist activeKey
  useEffect(() => {
    saveNavState('teaching-active-key', activeKey);
  }, [activeKey]);

  // Persist analysis context
  useEffect(() => {
    if (analysisStudent) {
      saveNavState('teaching-analysis', { student: analysisStudent, taskId: analysisTaskId, jobId: analysisJobId });
    } else {
      clearNavState('teaching-analysis');
    }
  }, [analysisStudent, analysisTaskId, analysisJobId]);

  // Validate restored activeKey — if it references a tab that no longer exists, fall back
  useEffect(() => {
    if (tabsRestored.current) return;
    tabsRestored.current = true;
    const courseKeys = ['tasks', 'submissions', 'students', 'attachments'];
    if (activeKey.startsWith('task-')) {
      const taskId = activeKey.slice('task-'.length);
      if (!openTasks.some((t) => t.id === taskId)) setActiveKey('tasks');
    } else if (activeKey.startsWith('analysis-') && !analysisStudent) {
      setActiveKey('tasks');
    } else if (!courseKeys.includes(activeKey) && !activeKey.startsWith('task-') && !activeKey.startsWith('analysis-')) {
      setActiveKey('tasks');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build all tab keys for adjacent-tab logic
  function allTabKeys(): string[] {
    const keys = ['tasks', 'submissions', 'students', 'attachments'];
    openTasks.forEach((t) => keys.push(`task-${t.id}`));
    if (analysisStudent) keys.push(`analysis-${analysisStudent.id}`);
    return keys;
  }

  function switchToAdjacentTab(closedKey: string) {
    const allKeys = allTabKeys();
    const closedIdx = allKeys.indexOf(closedKey);
    // Prefer the left neighbor; fall back to right neighbor
    const target = (closedIdx > 0 ? allKeys[closedIdx - 1] : allKeys[closedIdx + 1]) ?? 'tasks';
    setActiveKey(target);
  }

  function openTask(task: Task) {
    const tabKey = `task-${task.id}`;
    if (openTasks.some((item) => item.id === task.id)) {
      setActiveKey(tabKey);
      return;
    }
    if (openTasks.length >= 6) {
      messageApi.warning('最多同时打开 6 个作业页签，请先关闭不需要的页签');
      return;
    }
    setOpenTasks((items) => [...items, task]);
    setActiveKey(tabKey);
  }

  function closeTaskTab(taskId: string) {
    const tabKey = `task-${taskId}`;
    setOpenTasks((items) => items.filter((item) => item.id !== taskId));
    if (activeKey === tabKey) switchToAdjacentTab(tabKey);
  }

  function openAnalysis(student: Student, taskId?: string, jobId?: string) {
    setAnalysisStudent(student);
    setAnalysisTaskId(taskId);
    setAnalysisJobId(jobId);
    setAnalysisVersion((value) => value + 1);
    setActiveKey(`analysis-${student.id}`);
  }

  function closeAnalysisTab() {
    const tabKey = `analysis-${analysisStudent?.id}`;
    setAnalysisStudent(undefined);
    setAnalysisTaskId(undefined);
    setAnalysisJobId(undefined);
    if (activeKey === tabKey) switchToAdjacentTab(tabKey);
  }

  const navItems = [
    { key: 'tasks', icon: <BookOutlined />, label: '作业详情' },
    { key: 'submissions', icon: <UploadOutlined />, label: '提交作业' },
    { key: 'students', icon: <TeamOutlined />, label: '学生名单' },
    { key: 'attachments', icon: <PaperClipOutlined />, label: '课程附件' },
  ];
  const dynamicTabs = [
    ...openTasks.map((task) => ({ key: `task-${task.id}`, label: task.title })),
    ...(analysisStudent ? [{ key: `analysis-${analysisStudent.id}`, label: `作业详情：${analysisStudent.name}` }] : []),
  ];

  function renderContent() {
    switch (activeKey) {
      case 'tasks': return <CourseTasks course={course} onOpenTask={openTask} />;
      case 'submissions': return <CourseSubmissions courseId={course.id} onOpenAnalysis={openAnalysis} />;
      case 'students': return <CourseStudents courseId={course.id} />;
      case 'attachments': return <CourseAttachments courseId={course.id} />;
      default: {
        if (activeKey.startsWith('task-')) {
          const task = openTasks.find((t) => `task-${t.id}` === activeKey);
          return task ? <TaskDetail courseId={course.id} task={task} onOpenAnalysis={openAnalysis} /> : null;
        }
        if (activeKey.startsWith('analysis-') && analysisStudent) {
          return <AnalysisReviewWorkspace key={`${analysisStudent.id}-${analysisTaskId ?? 'legacy'}-${analysisVersion}`} student={analysisStudent} taskId={analysisTaskId} initialJobId={analysisJobId} />;
        }
        return null;
      }
    }
  }

  const isCourseNav = navItems.some((item) => item.key === activeKey);
  const showTabBar = !isCourseNav && dynamicTabs.length > 0;

  return <div className="course-tasks-page">
    {contextHolder}
    <section className="course-detail-heading">
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>返回课程</Button>
      <div className="course-detail-heading-sep" />
      <Text strong className="course-detail-heading-name">{course.name}</Text>
    </section>
    <div className="course-detail-layout">
      <nav className="course-sidebar">
        <div className="course-sidebar-nav">
          <Text type="secondary" className="course-sidebar-section-title">课程管理</Text>
          {navItems.map((item) => <Button key={item.key} type="text" block className={`course-sidebar-link${activeKey === item.key ? ' active' : ''}`} icon={item.icon} onClick={() => setActiveKey(item.key)}>{item.label}</Button>)}
        </div>
        {dynamicTabs.length > 0 && <div className="course-sidebar-nav">
          <div className="course-sidebar-divider" />
          <Text type="secondary" className="course-sidebar-section-title">已打开</Text>
          {dynamicTabs.map((tab) => <div key={tab.key} className="course-sidebar-tab">
            <Button type="text" block className={`course-sidebar-link${activeKey === tab.key ? ' active' : ''}`} onClick={() => setActiveKey(tab.key)}>
              {tab.key.startsWith('task-') ? <FileTextOutlined /> : <SearchOutlined />}<span className="course-sidebar-tab-label">{tab.label}</span>
            </Button>
            <Button type="text" size="small" className="course-sidebar-close" icon={<CloseOutlined />} onClick={() => { if (tab.key.startsWith('task-')) closeTaskTab(tab.key.slice('task-'.length)); else closeAnalysisTab(); }} />
          </div>)}
        </div>}
        <div className="course-sidebar-spacer" />
        <div className="course-sidebar-divider" />
        <CourseOverviewSidebar courseId={course.id} />
      </nav>
      <main className="course-detail-main">
        {showTabBar && <div className="course-content-tabs">
          {dynamicTabs.map((tab) => <button key={tab.key} className={`course-content-tab${activeKey === tab.key ? ' active' : ''}`} onClick={() => setActiveKey(tab.key)}>
            {tab.key.startsWith('task-') ? <FileTextOutlined /> : <SearchOutlined />}
            <span>{tab.label}</span>
            <CloseOutlined className="course-content-tab-close" onClick={(e) => { e.stopPropagation(); if (tab.key.startsWith('task-')) closeTaskTab(tab.key.slice('task-'.length)); else closeAnalysisTab(); }} />
          </button>)}
        </div>}
        <div className="course-content-body">
          {renderContent()}
        </div>
      </main>
    </div>
  </div>;
}

function CourseAttachments({ courseId }: { courseId: string }) {
  const [attachments, setAttachments] = useState<CourseAttachment[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const load = useCallback(async () => {
    try { setAttachments((await axios.get<CourseAttachment[]>(`/api/courses/${courseId}/attachments`)).data); }
    catch { messageApi.error('课程附件加载失败'); }
  }, [courseId, messageApi]);
  useEffect(() => { void load(); }, [load]);
  async function upload(file: File) {
    const data = new FormData(); data.append('file', file);
    try {
      const response = await axios.post<CourseAttachment>(`/api/courses/${courseId}/attachments`, data);
      setAttachments((items) => [...items, response.data]);
      messageApi.success('课程附件已上传');
    } catch { messageApi.error(`附件“${file.name}”上传失败`); }
  }
  return <Card size="small" title="课程附件" extra={<Upload multiple showUploadList={false} beforeUpload={(file) => { void upload(file); return Upload.LIST_IGNORE; }}><Button icon={<UploadOutlined />}>上传附件</Button></Upload>}>
    {contextHolder}{attachments.length ? <Space direction="vertical">{attachments.map((attachment) => <Button key={attachment.id} type="link" icon={<DownloadOutlined />} onClick={() => void downloadAuthenticatedFile(attachment.downloadUrl, attachment.fileName, messageApi)}>{attachment.fileName}</Button>)}</Space> : <Empty description="暂无课程附件" />}
  </Card>;
}

type SubmissionRecord = { id: string; studentId: string; submissionBatchId: string; fileName: string; submittedAt: string; downloadUrl: string; analysisJobId?: string | null };

function CourseOverviewSidebar({ courseId }: { courseId: string }) {
  const [stats, setStats] = useState<{ tasks: number; students: number; attachments: number }>({ tasks: 0, students: 0, attachments: 0 });
  useEffect(() => {
    let active = true;
    void Promise.all([
      axios.get<Task[]>(`/api/courses/${courseId}/tasks`),
      axios.get<Student[]>(`/api/courses/${courseId}/students`),
      axios.get<CourseAttachment[]>(`/api/courses/${courseId}/attachments`)
    ]).then(([tasks, students, attachments]) => {
      if (active) setStats({ tasks: tasks.data.length, students: students.data.length, attachments: attachments.data.length });
    }).catch(() => {});
    return () => { active = false; };
  }, [courseId]);

  return <Card size="small" title="课程概览" className="course-overview-sidebar">
    <div className="course-overview-stat"><Text type="secondary">作业</Text><Text strong>{stats.tasks}</Text></div>
    <div className="course-overview-stat"><Text type="secondary">学生</Text><Text strong>{stats.students}</Text></div>
    <div className="course-overview-stat"><Text type="secondary">附件</Text><Text strong>{stats.attachments}</Text></div>
  </Card>;
}

function CourseSubmissions({ courseId, onOpenAnalysis }: { courseId: string; onOpenAnalysis: (student: Student, taskId?: string, jobId?: string) => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [recordsByTask, setRecordsByTask] = useState<Record<string, SubmissionRecord[]>>({});
  const [loading, setLoading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    try {
      const [taskResponse, studentResponse] = await Promise.all([
        axios.get<Task[]>(`/api/courses/${courseId}/tasks`),
        axios.get<Student[]>(`/api/courses/${courseId}/students`)
      ]);
      setTasks(taskResponse.data);
      setStudents(studentResponse.data);
    } catch {
      messageApi.error('作业提交记录加载失败');
    }
  }, [courseId, messageApi]);

  const loadRecords = useCallback(async (taskId: string) => {
    if (recordsByTask[taskId]) return;
    setLoading(true);
    try {
      const response = await axios.get<SubmissionRecord[]>(`/api/tasks/${taskId}/submissions`);
      setRecordsByTask((items) => ({ ...items, [taskId]: response.data }));
    } catch {
      messageApi.error('提交记录加载失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi, recordsByTask]);

  useEffect(() => { void load(); }, [load]);
  function studentColumns(taskId: string, records: SubmissionRecord[]): ColumnsType<Student> {
    const latestByStudent = new Map<string, SubmissionRecord>();
    records.forEach((record) => { if (!latestByStudent.has(record.studentId)) latestByStudent.set(record.studentId, record); });
    return [
      { title: '学号', dataIndex: 'number', width: 150 },
      { title: '姓名', dataIndex: 'name', width: 130, render: (name, student) => <Button type="link" onClick={() => onOpenAnalysis(student, taskId)}>{name}</Button> },
      { title: '提交状态', width: 120, render: (_, student) => latestByStudent.has(student.id) ? <Tag color="green">已提交</Tag> : <Tag>未提交</Tag> },
      { title: '最近提交', render: (_, student) => { const record = latestByStudent.get(student.id); return record ? new Date(record.submittedAt).toLocaleString() : '-'; } },
      { title: '最新作业', render: (_, student) => { const record = latestByStudent.get(student.id); return record ? <Space size={4}>{isPreviewable(record.fileName) && <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setPreviewId(record.id); setPreviewFileName(record.fileName); setPreviewOpen(true); }}>预览</Button>}<Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => void downloadAuthenticatedFile(record.downloadUrl, record.fileName, messageApi)}>{record.fileName}</Button></Space> : '-'; } },
      { title: '提交次数', width: 100, render: (_, student) => new Set(records.filter((record) => record.studentId === student.id).map((record) => record.submissionBatchId)).size },
      { title: '智能分析', width: 150, render: (_, student) => {
        const submitted = latestByStudent.has(student.id);
        return <AnalysisTriggerButton taskId={taskId} studentId={student.id} submitted={submitted} hasExistingAnalysis={Boolean(latestByStudent.get(student.id)?.analysisJobId)} onStarted={(jobId) => onOpenAnalysis(student, taskId, jobId)} />;
      } }
    ];
  }

  return <Card className="course-student-card" size="small" title="提交作业">
    {contextHolder}
    <FilePreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} submissionId={previewId} fileName={previewFileName} />
    {tasks.length === 0 ? <Empty description="暂无课程作业" /> : <Collapse onChange={(keys) => { const activeKeys = Array.isArray(keys) ? keys : [keys]; const taskId = String(activeKeys[activeKeys.length - 1] ?? ''); if (taskId) void loadRecords(taskId); }} items={tasks.map((task) => ({
      key: task.id,
      label: task.title,
      children: <Table<Student> size="small" rowKey="id" loading={loading && !recordsByTask[task.id]} dataSource={students} columns={studentColumns(task.id, recordsByTask[task.id] ?? [])} locale={{ emptyText: <Empty description="暂无课程学生" /> }} pagination={{ pageSize: 8, showSizeChanger: false }} />
    }))} />}
  </Card>;
}

const RUNNING_STATUSES = new Set(['queued', 'extracting', 'running', 'transcribing']);

function AnalysisTriggerButton({ taskId, studentId, submitted, hasExistingAnalysis = false, onStarted }: {
  taskId: string;
  studentId: string;
  submitted: boolean;
  hasExistingAnalysis?: boolean;
  onStarted?: (jobId: string) => void;
}) {
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState<string>();
  const [running, setRunning] = useState(hasExistingAnalysis);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string }>();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!hasExistingAnalysis) return;
    let active = true;
    void axios.get<{ status: string }>(`/api/tasks/${taskId}/students/${studentId}/analysis`, { timeout: 5000 })
      .then((res) => { if (active) setRunning(RUNNING_STATUSES.has(res.data.status)); })
      .catch(() => {});
    return () => { active = false; };
  }, [hasExistingAnalysis, taskId, studentId]);

  async function start() {
    setStarting(true);
    setFeedback(undefined);
    try {
      const response = await axios.post<{ jobId: string; fileCount: number }>(`/api/tasks/${taskId}/students/${studentId}/analysis`);
      setJobId(response.data.jobId);
      setRunning(true);
      const text = `已创建任务，分析 ${response.data.fileCount} 个文件`;
      setFeedback({ type: 'success', text });
      messageApi.success(text);
      onStarted?.(response.data.jobId);
    } catch (error) {
      const detail = axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : '创建智能分析任务失败';
      setFeedback({ type: 'error', text: detail });
      messageApi.error(detail);
    } finally {
      setStarting(false);
    }
  }

  const disabled = !submitted || running;
  const label = running ? '分析中...' : (jobId || hasExistingAnalysis ? '重新分析' : '开始分析');

  return <>{contextHolder}<Space direction="vertical" size={3}>
    <Button size="small" icon={<PlayCircleOutlined />} disabled={disabled} loading={starting} onClick={() => void start()}>{label}</Button>
    {feedback && <Text type={feedback.type === 'error' ? 'danger' : 'success'} className="analysis-trigger-feedback">{feedback.text}</Text>}
  </Space></>;
}

function TaskSubmissionTable({ courseId, taskId, onOpenAnalysis }: {
  courseId: string;
  taskId: string;
  onOpenAnalysis: (student: Student, taskId?: string, jobId?: string) => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [studentResponse, submissionResponse] = await Promise.all([
        axios.get<Student[]>(`/api/courses/${courseId}/students`),
        axios.get<SubmissionRecord[]>(`/api/tasks/${taskId}/submissions`)
      ]);
      setStudents(studentResponse.data);
      setRecords(submissionResponse.data);
    } catch {
      messageApi.error('学生提交情况加载失败');
    } finally {
      setLoading(false);
    }
  }, [courseId, messageApi, taskId]);

  useEffect(() => { void load(); }, [load]);

  const latestByStudent = new Map<string, SubmissionRecord>();
  records.forEach((record) => {
    if (!latestByStudent.has(record.studentId)) latestByStudent.set(record.studentId, record);
  });

  const columns: ColumnsType<Student> = [
    { title: '学号', dataIndex: 'number', width: 150 },
    { title: '姓名', dataIndex: 'name', width: 140, render: (name, student) => <Button type="link" onClick={() => onOpenAnalysis(student, taskId)}>{name}</Button> },
    { title: '提交状态', width: 110, render: (_, student) => latestByStudent.has(student.id) ? <Tag color="green">已提交</Tag> : <Tag>未提交</Tag> },
    { title: '最近提交', render: (_, student) => { const record = latestByStudent.get(student.id); return record ? new Date(record.submittedAt).toLocaleString() : '-'; } },
    { title: '最新作业', render: (_, student) => { const record = latestByStudent.get(student.id); return record ? <Space size={4}>{isPreviewable(record.fileName) && <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setPreviewId(record.id); setPreviewFileName(record.fileName); setPreviewOpen(true); }}>预览</Button>}<Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => void downloadAuthenticatedFile(record.downloadUrl, record.fileName, messageApi)}>{record.fileName}</Button></Space> : '-'; } },
    { title: '提交次数', width: 100, render: (_, student) => new Set(records.filter((record) => record.studentId === student.id).map((record) => record.submissionBatchId)).size },
    { title: '智能分析', width: 150, render: (_, student) => <AnalysisTriggerButton taskId={taskId} studentId={student.id} submitted={latestByStudent.has(student.id)} hasExistingAnalysis={Boolean(latestByStudent.get(student.id)?.analysisJobId)} onStarted={(jobId) => onOpenAnalysis(student, taskId, jobId)} /> }
  ];

  return <Card className="task-detail-summary" size="small" title="学生提交情况">
    {contextHolder}
    <FilePreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} submissionId={previewId} fileName={previewFileName} />
    <Table<Student> size="small" rowKey="id" loading={loading} dataSource={students} columns={columns} locale={{ emptyText: <Empty description="暂无课程学生" /> }} pagination={{ pageSize: 8, showSizeChanger: false }} />
  </Card>;
}

type PersistedAnalysisReview = {
  status: 'PENDING_REVIEW' | 'REVISED' | 'PUBLISHED';
  ruleScore?: number | null;
  qualityReferenceScore?: number | null;
  comment?: string | null;
  aiReport?: Record<string, unknown> | null;
};
type ReviewAnalysisJobRow = {
  jobId: string;
  fileName: string;
  submittedAt: string;
  review?: PersistedAnalysisReview;
  analysis: {
    status: string;
    progress?: number;
    error?: string;
    assessment_report?: Record<string, unknown>;
    assessment_context?: Record<string, unknown>;
    trace?: Array<{
      stage: string;
      status: string;
      created_at?: string;
      request_preview?: string;
      response_summary?: string;
      duration_ms?: number | null;
    }>;
    file_stages?: Array<{ file_name: string; stage: string; status: string; message?: string }>;
    result?: {
      warnings?: string[];
      evidence?: Array<{
        id: string;
        file_name: string;
        modality: string;
        locator: string;
        text?: string;
        metadata?: Record<string, unknown>;
      }>;
    };
  };
};

function reportEntries(report: Record<string, unknown> | null | undefined, key: string): Array<Record<string, unknown>> {
  const value = report?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    : [];
}

function EvidenceArtifact({ jobId, item }: {
  jobId: string;
  item: NonNullable<NonNullable<ReviewAnalysisJobRow['analysis']['result']>['evidence']>[number];
}) {
  const objectKey = typeof item.metadata?.artifactObjectKey === 'string' ? item.metadata.artifactObjectKey : null;
  const [url, setUrl] = useState<string>();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    if (!objectKey) {
      return;
    }
    setUrl(undefined);
    setUnavailable(false);
    void axios.get<Blob>(`/api/analysis/jobs/${jobId}/artifacts/content`, {
      params: { objectKey },
      responseType: 'blob'
    })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => { if (active) setUnavailable(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [jobId, objectKey]);

  if (!objectKey) {
    return null;
  }
  if (unavailable) {
    return <Text type="secondary">视觉证据图片暂不可访问</Text>;
  }
  return <div className="analysis-evidence-artifact">
    {url ? <Image src={url} alt={`${item.file_name} ${item.locator}`} width={220} preview /> : <Text type="secondary">正在加载视觉证据...</Text>}
    <Text type="secondary">{item.locator}</Text>
  </div>;
}

function queuedAnalysisJob(jobId: string): ReviewAnalysisJobRow {
  return {
    jobId,
    fileName: '本次提交作品',
    submittedAt: '',
    analysis: {
      status: 'queued',
      progress: 0,
      trace: [{ stage: 'manifest', status: 'queued', request_preview: '已创建重新分析任务，正在等待 Worker 接收。' }]
    }
  };
}

function exportAnalysisReport(job: ReviewAnalysisJobRow) {
  const data = JSON.stringify({ jobId: job.jobId, fileName: job.fileName, analysis: job.analysis, review: job.review }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `分析报告_${job.fileName}_${job.jobId.slice(0, 8)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadCourseAnalysis(
    taskId: string, studentId: string, preferredJobId?: string): Promise<ReviewAnalysisJobRow[]> {
  try {
    const jobId = preferredJobId ?? (await axios.get<{ jobId: string }>(
      `/api/tasks/${taskId}/students/${studentId}/analysis`, { timeout: 8000 })).data.jobId;
    if (!jobId) return [];
    const response = await axios.get<ReviewAnalysisJobRow['analysis'] & { review?: PersistedAnalysisReview }>(
      `/api/analysis/jobs/${jobId}`, { timeout: 8000 }
    );
    const evidence = response.data.result?.evidence ?? [];
    return [{
      jobId,
      fileName: evidence[0]?.file_name ?? '本次提交作品',
      submittedAt: '',
      analysis: response.data,
      review: response.data.review
    }];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

function InlineFilePreview({ submissionId, fileName, archiveEntry }: { submissionId: string; fileName: string; archiveEntry?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const category = getPreviewCategory(archiveEntry ?? fileName);

  useEffect(() => {
    if (!submissionId) return;
    setLoading(true); setError(null); setBlobUrl(null); setTextContent(null); setDocxHtml(null);
    const url = archiveEntry
      ? `/api/submissions/${submissionId}/archive-preview?entry=${encodeURIComponent(archiveEntry)}`
      : `/api/submissions/${submissionId}/preview`;
    axios.get(url, { responseType: 'blob' })
      .then(async (res) => {
        const blob = res.data as Blob;
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        if (category === 'text') {
          try { setTextContent(await blob.text()); } catch { setError('文本读取失败'); }
        } else if (category === 'word') {
          try { const buf = await blob.arrayBuffer(); setDocxHtml((await mammoth.convertToHtml({ arrayBuffer: buf })).value); } catch { setError('Word 文档解析失败'); }
        }
      })
      .catch(() => setError('文件加载失败'))
      .finally(() => setLoading(false));
  }, [submissionId, archiveEntry, category]);

  if (loading) return <div className="file-preview-loading"><Spin tip="加载中..." /></div>;
  if (error) return <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  if (!blobUrl) return null;

  switch (category) {
    case 'image': return <img className="file-preview-image" src={blobUrl} alt={fileName} />;
    case 'video': return <video controls className="file-preview-media" src={blobUrl} />;
    case 'audio': return <div className="file-preview-audio-wrapper"><audio controls src={blobUrl} /></div>;
    case 'pdf': return <iframe className="file-preview-iframe" src={blobUrl} title={fileName} />;
    case 'word': return docxHtml ? <div className="file-preview-docx" dangerouslySetInnerHTML={{ __html: docxHtml }} /> : <Spin tip="解析中..." />;
    case 'text': return textContent !== null ? <pre className="file-preview-text">{textContent}</pre> : <Spin tip="读取中..." />;
    default: return <Empty description="该文件类型不支持预览" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
}

function AnalysisReviewWorkspace({ student, taskId, initialJobId }: {
  student: Student;
  taskId?: string;
  initialJobId?: string;
}) {
  const [jobs, setJobs] = useState<ReviewAnalysisJobRow[]>([]);
  const [selected, setSelected] = useState<ReviewAnalysisJobRow>();
  const [loading, setLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState(initialJobId);
  const [loadError, setLoadError] = useState<string>();
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ruleScore, setRuleScore] = useState<number | null>();
  const [qualityScore, setQualityScore] = useState<number | null>();
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState<string>(() => loadNavState<string>('analysis-review-tab', 'detail'));
  const [teacherComments, setTeacherComments] = useState<Array<{ id: string; authorRole: string; authorName: string; content: string; createdAt: string; attachmentFileName: string | null; attachmentUrl: string | null }>>([]);
  const [teacherCommentsLoading, setTeacherCommentsLoading] = useState(false);
  const [teacherCommentText, setTeacherCommentText] = useState('');
  const [teacherCommentFile, setTeacherCommentFile] = useState<File | null>(null);
  const [sendingTeacherComment, setSendingTeacherComment] = useState(false);
  const [submissionHistory, setSubmissionHistory] = useState<Array<{ id: string; fileName: string; submittedAt: string; downloadUrl: string; archiveEntries: string[] }>>([]);
  const [subHistoryLoading, setSubHistoryLoading] = useState(false);
  const [inlinePreviewFile, setInlinePreviewFile] = useState<typeof submissionHistory[number] | null>(null);
  const [inlinePreviewEntry, setInlinePreviewEntry] = useState<string | undefined>(undefined);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async (silent = false) => {
    setLoading(true);
    try {
      const data = taskId
        ? await loadCourseAnalysis(taskId, student.id, activeJobId)
        : (await axios.get<ReviewAnalysisJobRow[]>(`/api/analysis/students/${student.id}/jobs`, { timeout: 8000 })).data;
      setJobs(data);
      setSelected((current) => data.find((item) => item.jobId === current?.jobId) ?? data[0]);
      setActiveJobId(data[0]?.jobId);
      setLoadError(undefined);
    } catch {
      const pending = activeJobId ? queuedAnalysisJob(activeJobId) : undefined;
      if (pending) {
        setJobs((items) => items.some((item) => item.jobId === pending.jobId) ? items : [pending, ...items]);
        setSelected((current) => current ?? pending);
      }
      setLoadError('暂时无法读取分析进度，系统将在 3 秒后自动重试。');
      if (!silent) messageApi.error('分析审核记录加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeJobId, messageApi, student.id, taskId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const status = selected?.analysis.status;
    if (!status || ["completed", "partial", "failed"].includes(status)) {
      return;
    }
    const timer = window.setInterval(() => void load(true), 3000);
    return () => window.clearInterval(timer);
  }, [load, selected?.analysis.status]);
  useEffect(() => {
    setRuleScore(selected?.review?.ruleScore ?? null);
    setQualityScore(selected?.review?.qualityReferenceScore ?? null);
    setComment(selected?.review?.comment ?? '');
  }, [selected?.jobId, selected?.review]);

  // 保存标签页状态
  useEffect(() => {
    saveNavState('analysis-review-tab', activeTab);
  }, [activeTab]);

  // Load teacher comments when taskId is available
  useEffect(() => {
    if (!taskId) return;
    setTeacherCommentsLoading(true);
    axios.get<Array<{ id: string; authorRole: string; authorName: string; content: string; createdAt: string; attachmentFileName: string | null; attachmentUrl: string | null }>>(`/api/tasks/${taskId}/students/${student.id}/comments`)
      .then((res) => setTeacherComments(res.data))
      .catch(() => {})
      .finally(() => setTeacherCommentsLoading(false));
  }, [taskId, student.id]);

  // Load submission history when taskId is available
  useEffect(() => {
    if (!taskId) return;
    setSubHistoryLoading(true);
    axios.get<Array<{ id: string; submittedAt: string; files: Array<{ id: string; fileName: string; submittedAt: string; downloadUrl: string; archiveEntries: string[] }> }>>(`/api/tasks/${taskId}/students/${student.id}/submissions`)
      .then((res) => {
        const files = res.data.flatMap((batch) => batch.files);
        setSubmissionHistory(files);
        if (files.length > 0) {
          const latest = files[0];
          const firstPreviewable = (latest.archiveEntries ?? []).find((e) => isPreviewable(e.split('/').pop() ?? e));
          setInlinePreviewEntry(firstPreviewable);
        }
      })
      .catch(() => {})
      .finally(() => setSubHistoryLoading(false));
  }, [taskId, student.id]);

  async function sendTeacherComment() {
    if (!taskId || !teacherCommentText.trim()) return;
    setSendingTeacherComment(true);
    try {
      const form = new FormData();
      form.append('content', teacherCommentText.trim());
      if (teacherCommentFile) form.append('file', teacherCommentFile);
      const res = await axios.post<{ id: string; authorRole: string; authorName: string; content: string; createdAt: string; attachmentFileName: string | null; attachmentUrl: string | null }>(`/api/tasks/${taskId}/students/${student.id}/comments`, form);
      setTeacherComments((prev) => [...prev, res.data]);
      setTeacherCommentText('');
      setTeacherCommentFile(null);
    } catch {
      messageApi.error('回复发送失败');
    } finally {
      setSendingTeacherComment(false);
    }
  }

  async function save(publish: boolean) {
    if (!selected) return;
    setSaving(true);
    try {
      const revised = (await axios.put<PersistedAnalysisReview>(`/api/analysis/jobs/${selected.jobId}/review`, {
        ruleScore,
        qualityReferenceScore: qualityScore,
        comment
      })).data;
      const review = publish
        ? (await axios.post<PersistedAnalysisReview>(`/api/analysis/jobs/${selected.jobId}/review/publish`)).data
        : revised;
      setJobs((items) => items.map((item) => item.jobId === selected.jobId ? { ...item, review } : item));
      setSelected((item) => item ? { ...item, review } : item);
      messageApi.success(publish ? '审核结果已发布' : '审核修改已保存');
    } catch (error) {
      const detail = axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : publish ? '审核结果发布失败' : '审核修改保存失败';
      messageApi.error(detail);
    } finally {
      setSaving(false);
    }
  }

  async function cancelAnalysis() {
    if (!selected) return;
    setSaving(true);
    try {
      const analysis = (await axios.delete<ReviewAnalysisJobRow['analysis']>(`/api/analysis/jobs/${selected.jobId}`)).data;
      setJobs((items) => items.map((item) => item.jobId === selected.jobId ? { ...item, analysis } : item));
      setSelected((item) => item ? { ...item, analysis } : item);
      messageApi.success('分析任务已强制停止');
    } catch {
      messageApi.error('停止分析任务失败');
    } finally {
      setSaving(false);
    }
  }

  async function batchExport() {
    if (selectedJobIds.length === 0) {
      messageApi.warning('请先选择要导出的分析作业');
      return;
    }
    setExporting(true);
    try {
      const response = await axios.post('/api/analysis/jobs/export', { jobIds: selectedJobIds }, { responseType: 'blob' });
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
      downloadBlob(response.data as Blob, `分析报告_${student.name}_${timestamp}.zip`);
      messageApi.success(`已导出 ${selectedJobIds.length} 份分析报告`);
    } catch {
      messageApi.error('批量导出失败');
    } finally {
      setExporting(false);
    }
  }

  const report = selected?.analysis.assessment_report ?? selected?.review?.aiReport;
  const evidence = selected?.analysis.result?.evidence ?? [];
  const warnings = selected?.analysis.result?.warnings ?? [];
  const visualEvidence = evidence.filter((item) => typeof item.metadata?.artifactObjectKey === 'string');
  const ocrEvidence = evidence.filter((item) => item.modality === 'image-ocr' || item.modality === 'image-code');
  const sourceCodeEvidence = evidence.filter((item) => item.modality === 'source-code');
  const evidenceReferenceById = new Map(evidence.map((item, index) => [item.id, `E${String(index + 1).padStart(3, '0')}`]));
  const conciseEvidenceIds = (values: string[]) => values.map((value) =>
    evidenceReferenceById.get(value) ?? (value.length > 32 ? `${value.slice(0, 29)}...` : value)
  ).join(', ');
  const generatedRubric = reportEntries(report, 'generatedRubric');
  const scoreBreakdown = reportEntries(report, 'scoreBreakdown');
  const strengths = reportEntries(report, 'strengths');
  const deductions = reportEntries(report, 'deductions');
  const qualityFindings = reportEntries(report, 'qualityFindings');
  const suggestions = Array.isArray(report?.suggestions) ? report.suggestions.map(String) : [];
  const guidance = reportEntries(report, 'guidance');
  const analysisError = selected?.analysis.error;
  const stageLabels: Record<string, string> = {
    manifest: '整理提交文件',
    extract: '提取文件内容与视觉证据',
    transcribe: '转录视频音频并关联时间戳',
    summarize: '分批解析图片与关键帧',
    assess: '调用模型生成评分报告'
  };
  const currentFileStages = selected?.analysis.file_stages ?? [];
  const stageOrder = ['manifest', 'extract', 'transcribe', 'summarize', 'assess'];
  const trace = selected?.analysis.trace ?? [];
  const assessmentContext = selected?.analysis.assessment_context;
  const archiveMembers = Array.isArray(assessmentContext?.files)
    ? (assessmentContext.files as Array<Record<string, unknown>>).flatMap((file) =>
      file.mediaType === 'archive' && Array.isArray(file.artifacts)
        ? file.artifacts as Array<Record<string, unknown>>
        : [])
    : [];
  const activeStageIndex = Math.max(0, stageOrder.reduce((latest, stage, index) =>
    trace.some((item) => item.stage === stage && ["running", "completed"].includes(item.status)) ? index : latest, 0));
  const analysisComplete = ["completed", "partial", "failed", "cancelled"].includes(selected?.analysis.status ?? "");
  return <div className="course-tasks-page">
    {contextHolder}
    <section className="course-detail-heading analysis-review-heading">
      <div className="analysis-review-title">
        <Text type="secondary">学生作业</Text>
        <Title level={3}>{student.name}的作业详情</Title>
      </div>
      <Space className="analysis-review-actions" wrap>
        {selected && <Button icon={<DownloadOutlined />} onClick={() => exportAnalysisReport(selected)}>导出当前</Button>}
        {selectedJobIds.length > 0 && <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void batchExport()}>批量导出 ({selectedJobIds.length})</Button>}
        <Button onClick={() => void load()} loading={loading}>刷新</Button>
        {selected && !analysisComplete && <Popconfirm
          title="确定强制停止当前分析吗？"
          description="已提取的证据会保留，但不会继续评分。"
          okText="停止分析"
          cancelText="继续分析"
          onConfirm={() => void cancelAnalysis()}
        >
          <Button danger loading={saving}>强制停止</Button>
        </Popconfirm>}
      </Space>
    </section>
    <div className="student-analysis-workspace">
      <Card size="small" title={<Space>分析作业{selectedJobIds.length > 0 && <Tag color="blue">已选 {selectedJobIds.length} 项</Tag>}</Space>} className="analysis-job-list-card">
        <Table<ReviewAnalysisJobRow>
          rowKey="jobId"
          size="small"
          loading={loading}
          dataSource={jobs}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedJobIds,
            onChange: (keys) => setSelectedJobIds(keys as string[]),
          }}
          onRow={(row) => ({ onClick: () => setSelected(row) })}
          columns={[
            { title: '作品', dataIndex: 'fileName' },
            { title: '分析状态', render: (_, row) => <Tag>{row.analysis.status}</Tag> },
            { title: '审核状态', render: (_, row) => <Tag color={row.review?.status === 'PUBLISHED' ? 'green' : row.review?.status === 'REVISED' ? 'blue' : 'gold'}>{row.review?.status ?? '等待报告'}</Tag> },
            { title: '进度', render: (_, row) => `${row.analysis.progress ?? 0}%` }
          ]}
        />
      </Card>
      <Card size="small" title="作业详情" className="analysis-review-panel">
        {loadError && <Text type="warning">{loadError}</Text>}
        <Space direction="vertical" size={12} className="full-width">
          {selected && <>
            {/* ── Top fixed: scoring & review ── */}
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="作品">{selected.fileName}</Descriptions.Item>
              <Descriptions.Item label="AI参考分">{report?.aiQualityReferenceScore == null ? '未生成' : String(report.aiQualityReferenceScore)}</Descriptions.Item>
              <Descriptions.Item label="规则计算分">{report?.ruleScore == null ? '未生成' : String(report.ruleScore)}</Descriptions.Item>
              <Descriptions.Item label="完整性">{String((report?.completeness as { complete?: boolean } | undefined)?.complete ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="审核状态">{selected.review?.status ?? '等待报告'}</Descriptions.Item>
            </Descriptions>
            {selected.review && <><Space wrap>
              <Space><Text>规则得分</Text><InputNumber min={0} max={100} precision={2} value={ruleScore} onChange={setRuleScore} /></Space>
              <Space><Text>AI参考分</Text><InputNumber min={0} max={100} precision={2} value={qualityScore} onChange={setQualityScore} /></Space>
            </Space>
            <Input.TextArea rows={3} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="填写教师审核意见" />
            <Space>
              <Button loading={saving} onClick={() => void save(false)}>保存审核</Button>
              <Button type="primary" loading={saving} disabled={selected.review.status === 'PUBLISHED'} onClick={() => void save(true)}>发布结果</Button>
            </Space></>}
          </>}
          {/* ── Tabs: detail / analysis ── */}
          <Tabs activeKey={selected ? activeTab : 'detail'} onChange={setActiveTab} items={[
            {
              key: 'detail',
              label: '作业详情',
              children: <Space direction="vertical" size={12} className="full-width">
                <section>
                  <Text strong>提交文件</Text>
                  {subHistoryLoading ? <Text type="secondary">加载中...</Text> : submissionHistory.length
                    ? (() => { const latest = submissionHistory[0]; return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => void downloadAuthenticatedFile(latest.downloadUrl, latest.fileName, messageApi)}>{latest.fileName}</Button>
                        <Text type="secondary">{new Date(latest.submittedAt).toLocaleString()}</Text>
                        {isPreviewable(latest.fileName) && <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setInlinePreviewFile(latest); setInlinePreviewEntry(undefined); }}>预览</Button>}
                      </div>; })()
                    : <Text type="secondary">暂无提交记录</Text>}
                </section>
                {submissionHistory.length > 0 && (() => { const latest = submissionHistory[0]; const entries = latest.archiveEntries ?? []; return <section>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong>文件预览</Text>
                  </div>
                  {entries.length > 0 && <Space size={4} wrap style={{ marginBottom: 8 }}>
                    {entries.map((e) => {
                      const entryFileName = e.split('/').pop() ?? e;
                      const canPrev = isPreviewable(entryFileName);
                      return <Button key={e} size="small" type={inlinePreviewEntry === e ? 'primary' : canPrev ? 'default' : 'dashed'} disabled={!canPrev} onClick={() => setInlinePreviewEntry(e)}>{entryFileName}</Button>;
                    })}
                  </Space>}
                  {entries.length === 0 && !isPreviewable(latest.fileName) && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该文件类型暂不支持预览，请下载查看" />}
                  {(isPreviewable(latest.fileName) || entries.length > 0) && <InlineFilePreview submissionId={latest.id} fileName={latest.fileName} archiveEntry={entries.length > 0 ? inlinePreviewEntry : undefined} />}
                </section>; })()}
                <section>
                  <Text strong>留言交流（{teacherComments.length}）</Text>
                  {teacherCommentsLoading ? <Text type="secondary">加载中...</Text> : <>
                    <Space direction="vertical" size={8} className="full-width">
                      {teacherComments.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无留言" />}
                      {teacherComments.map((c) => <div key={c.id} className={`comment-item comment-${c.authorRole.toLowerCase()}`}>
                        <div className="comment-header"><Tag color={c.authorRole === 'TEACHER' ? 'orange' : 'blue'}>{c.authorRole === 'TEACHER' ? '教师' : '学生'}</Tag><Text strong>{c.authorName}</Text><Text type="secondary" className="comment-time">{new Date(c.createdAt).toLocaleString()}</Text></div>
                        <div className="comment-content">{c.content}</div>
                        {c.attachmentFileName && c.attachmentUrl && <div className="comment-attachment"><Button type="link" size="small" icon={<PaperClipOutlined />} href={c.attachmentUrl}>{c.attachmentFileName}</Button></div>}
                      </div>)}
                    </Space>
                    <div style={{ marginTop: 8 }}>
                      <Input.TextArea rows={2} maxLength={2000} value={teacherCommentText} onChange={(e) => setTeacherCommentText(e.target.value)} placeholder="回复学生..." onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); void sendTeacherComment(); } }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <Upload showUploadList={false} beforeUpload={(file) => { setTeacherCommentFile(file); return Upload.LIST_IGNORE; }}>
                          <Button size="small" icon={<PaperClipOutlined />}>{teacherCommentFile ? teacherCommentFile.name : '添加附件'}</Button>
                        </Upload>
                        {teacherCommentFile && <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setTeacherCommentFile(null)} />}
                        <Button type="primary" size="small" loading={sendingTeacherComment} disabled={!teacherCommentText.trim()} onClick={() => void sendTeacherComment()}>回复</Button>
                      </div>
                    </div>
                  </>}
                </section>
              </Space>
            },
            ...(selected ? [{
              key: 'analysis',
              label: '智能分析',
              children: <Space direction="vertical" size={12} className="full-width">
          <section className="analysis-run-progress">
            <Space direction="vertical" size={8} className="full-width">
              <div className="analysis-run-progress-heading">
                <Text strong>分析进度</Text>
                <Tag color={selected.analysis.status === 'failed' ? 'red' : selected.analysis.status === 'completed' || selected.analysis.status === 'partial' ? 'green' : 'blue'}>{selected.analysis.status}</Tag>
              </div>
              <Progress percent={Math.max(0, Math.min(100, selected.analysis.progress ?? 0))} status={selected.analysis.status === 'failed' ? 'exception' : selected.analysis.status === 'completed' || selected.analysis.status === 'partial' ? 'success' : 'active'} />
              <Steps
                size="small"
                current={analysisComplete ? stageOrder.length : activeStageIndex}
                status={selected.analysis.status === 'failed' ? 'error' : analysisComplete ? 'finish' : 'process'}
                items={stageOrder.map((stage) => ({ title: stageLabels[stage] }))}
              />
              {currentFileStages.length > 0 && <Space direction="vertical" size={3} className="full-width">
                {currentFileStages.map((stage) => <Text key={stage.file_name} type={stage.status === 'failed' ? 'danger' : 'secondary'}>
                  {stage.file_name}: {stage.stage}{stage.message ? ` - ${stage.message}` : ''}
                </Text>)}
              </Space>}
            </Space>
          </section>
          <section className="analysis-run-trace">
            <Text strong>分析过程</Text>
            <Timeline
              items={trace.map((item) => ({
                color: item.status === 'failed' ? 'red' : item.status === 'completed' ? 'green' : item.status === 'running' ? 'blue' : 'gray',
                children: <Space direction="vertical" size={1}>
                  <Text>{stageLabels[item.stage] ?? item.stage}：{item.status}</Text>
                  {item.request_preview && <Text type="secondary">{item.request_preview}</Text>}
                  {item.response_summary && <Text type="secondary">{item.response_summary}</Text>}
                  {item.duration_ms != null && <Text type="secondary">耗时 {item.duration_ms}ms</Text>}
                </Space>
              }))}
            />
          </section>
          <section className="analysis-ocr-results">
            <Text strong>OCR 识别结果（{ocrEvidence.length}）</Text>
            {ocrEvidence.length
              ? <Collapse
                size="small"
                items={ocrEvidence.map((item) => ({
                  key: item.id,
                  label: `${item.file_name} - ${item.locator}${item.modality === 'image-code' ? '（识别为代码）' : ''}`,
                  children: <pre className="analysis-evidence-metadata">{item.text || '未识别到可用文字'}</pre>
                }))}
              />
              : <Text type="secondary">当前尚未完成图片或视频关键帧的 OCR 识别。</Text>}
          </section>
          <section className="analysis-source-code-results">
            <Text strong>源代码提取结果（{sourceCodeEvidence.length}）</Text>
            {sourceCodeEvidence.length
              ? <Collapse
                size="small"
                items={sourceCodeEvidence.map((item) => ({
                  key: item.id,
                  label: `${item.locator}（${String(item.metadata?.language ?? 'code')}）`,
                  children: <pre className="analysis-evidence-metadata">{item.text || ''}</pre>
                }))}
              />
              : <Text type="secondary">当前提交中未提取到可分析的源代码文件。</Text>}
          </section>
          <section className="analysis-assessment-context">
            <Text strong>最终结构化上下文</Text>
            {assessmentContext
              ? <Space direction="vertical" size={8} className="full-width">
                {archiveMembers.length > 0 && <section className="analysis-archive-members">
                  <Text type="secondary">压缩包成员（{archiveMembers.length}）</Text>
                  <pre className="analysis-evidence-metadata">{JSON.stringify(archiveMembers, null, 2)}</pre>
                </section>}
                <pre className="analysis-evidence-metadata">{JSON.stringify(assessmentContext, null, 2)}</pre>
              </Space>
              : <Text type="secondary">当前任务尚未生成结构化上下文。请重启 AI Worker 后重新分析，分析开始时会显示该内容。</Text>}
          </section>
          {analysisError && <Text type="danger">分析失败：{analysisError}。请检查模型配置后重新分析。</Text>}
          <section className="analysis-visual-gallery">
            <Text strong>视觉证据与视频关键帧（{visualEvidence.length}）</Text>
            {visualEvidence.length
              ? <div className="analysis-visual-gallery-grid">{visualEvidence.map((item) => <EvidenceArtifact key={item.id} jobId={selected.jobId} item={item} />)}</div>
              : <Text type="secondary">本次提交未提取到可展示的图片或视频关键帧。</Text>}
          </section>
          <div className="analysis-report-summary">
            <section className="analysis-report-table-section">
              <Text strong>AI 生成的评分规则</Text>
              {generatedRubric.length
                ? <Table<Record<string, unknown>>
                  size="small"
                  rowKey={(_, index) => `rubric-${index}`}
                  pagination={false}
                  dataSource={generatedRubric}
                  scroll={{ x: 820 }}
                  columns={[
                    { title: '评分项', width: 180, render: (_, item) => String(item.criterion ?? '未命名评分项') },
                    { title: '评分说明', render: (_, item) => <Text className="analysis-table-wrapped-text">{String(item.description ?? '-')}</Text> },
                    { title: '满分', width: 72, render: (_, item) => String(item.maxPoints ?? '-') },
                    { title: '来源', width: 96, render: (_, item) => item.source === 'ai_generated' ? 'AI 生成' : '已提供规则' }
                  ]}
                />
                : <Text type="secondary">当前评分规则已包含明确分值，或 AI 尚未生成评分量表。</Text>}
            </section>
            <section className="analysis-report-table-section">
              <Text strong>规则评分与扣分明细</Text>
              {scoreBreakdown.length
                ? <Table<Record<string, unknown>>
                  size="small"
                  rowKey={(_, index) => `score-${index}`}
                  pagination={false}
                  dataSource={scoreBreakdown}
                  scroll={{ x: 900 }}
                  columns={[
                    { title: '评分项', width: 180, render: (_, item) => <Text className="analysis-table-wrapped-text">{String(item.criterion ?? item.rule ?? '未命名评分项')}</Text> },
                    { title: '满分', width: 72, render: (_, item) => String(item.maxPoints ?? '-') },
                    { title: '得分', width: 72, render: (_, item) => String(item.awardedPoints ?? '-') },
                    { title: '扣分', width: 72, render: (_, item) => <Text type={Number(item.deductedPoints ?? 0) > 0 ? 'danger' : undefined}>{String(item.deductedPoints ?? 0)}</Text> },
                    { title: '扣分原因与证据', width: 420, render: (_, item) => <Space direction="vertical" size={1}><Text className="analysis-table-wrapped-text">{String(item.deductionReason ?? '无扣分')}</Text>{Array.isArray(item.evidenceIds) && item.evidenceIds.length > 0 && <Text className="analysis-table-wrapped-text" type="secondary">证据：{conciseEvidenceIds(item.evidenceIds.map(String))}</Text>}</Space> }
                  ]}
                />
                : <Text type="secondary">当前规则没有可计算的分项，或该报告生成时未返回评分明细。</Text>}
            </section>
            <section>
              <Text strong>规则符合项与优点</Text>
              {strengths.length
                ? strengths.map((item, index) => <div key={`summary-strength-${index}`}><Tag color="green">符合</Tag><Text strong>{String(item.rule ?? '规则要求')}</Text><Text>：{String(item.reason ?? '已满足相关要求')}</Text></div>)
                : <Text type="secondary">模型尚未返回可核验的规则符合项。</Text>}
            </section>
            <section>
              <Text strong>扣分原因</Text>
              {deductions.length
                ? deductions.map((item, index) => <div key={`summary-deduction-${index}`}><Tag color="red">扣分</Tag><Text>{String(item.reason ?? '未说明原因')}</Text></div>)
                : <Text type="secondary">未发现明确的扣分项</Text>}
            </section>
            <section>
              <Text strong>待改进点</Text>
              {qualityFindings.length
                ? qualityFindings.map((item, index) => <div key={`summary-quality-${index}`}><Tag color={item.impact === 'critical' ? 'red' : item.impact === 'material' ? 'orange' : 'blue'}>{String(item.aspect ?? item.impact ?? '质量')}</Tag><Text>{String(item.reason ?? '未说明发现')}</Text>{typeof item.details === 'string' && <Text type="secondary">：{item.details}</Text>}</div>)
                : <Text type="secondary">未生成质量缺点；可查看原始报告或重新分析。</Text>}
            </section>
            <section>
              <Text strong>后续修改指导</Text>
              {guidance.length
                ? guidance.map((item, index) => <div key={`summary-guidance-${index}`}><Tag color={item.priority === 'high' ? 'red' : item.priority === 'medium' ? 'orange' : 'blue'}>{String(item.priority ?? 'medium')}</Tag><Text strong>{String(item.target ?? '修改位置')}</Text><Text>：{String(item.action ?? '未说明修改动作')}</Text><Text type="secondary"> 预期：{String(item.expectedImprovement ?? item.rationale ?? '提升作品质量')}</Text></div>)
                : <Text type="secondary">当前报告未包含定位式修改指导；重新分析后将生成具体位置、修改动作和预期效果。</Text>}
            </section>
            <section>
              <Text strong>改进建议</Text>
              {suggestions.length
                ? suggestions.map((item, index) => <Text key={`summary-suggestion-${index}`}>{index + 1}. {item}</Text>)
                : <Text type="secondary">未生成改进建议；可查看原始报告或重新分析。</Text>}
            </section>
          </div>
          <Text>{String(report?.rawText ?? '')}</Text>
          <Text type="secondary">运行阶段：{selected.analysis.trace?.map((item) => `${item.stage}:${item.status}`).join(' -> ')}</Text>
          <Collapse
            size="small"
            items={[
              {
                key: 'scoring',
                label: `评分依据（符合 ${strengths.length} 项，扣分 ${deductions.length} 项，质量发现 ${qualityFindings.length} 项）`,
                children: <Space direction="vertical" size={10} className="full-width">
                  {strengths.length === 0 && deductions.length === 0 && qualityFindings.length === 0 && guidance.length === 0 && suggestions.length === 0 && <Text type="secondary">模型尚未返回结构化评分依据</Text>}
                  {strengths.map((item, index) => <div key={`strength-${index}`}><Tag color="green">符合</Tag><Text strong>{String(item.rule ?? '规则要求')}</Text><Text>：{String(item.reason ?? '已满足相关要求')}</Text>{Array.isArray(item.evidenceIds) && <Text type="secondary"> 证据：{conciseEvidenceIds(item.evidenceIds.map(String))}</Text>}</div>)}
                  {deductions.map((item, index) => <div key={`deduction-${index}`}><Tag color="red">扣分</Tag><Text>{String(item.reason ?? '未说明原因')}</Text>{Array.isArray(item.evidenceIds) && <Text type="secondary"> 证据：{conciseEvidenceIds(item.evidenceIds.map(String))}</Text>}</div>)}
                  {qualityFindings.map((item, index) => <div key={`quality-${index}`}><Tag color={item.impact === 'critical' ? 'red' : item.impact === 'material' ? 'orange' : 'blue'}>{String(item.aspect ?? item.impact ?? '质量')}</Tag><Text>{String(item.reason ?? '未说明发现')}</Text>{typeof item.details === 'string' && <Text type="secondary">：{item.details}</Text>}{Array.isArray(item.evidenceIds) && <Text type="secondary"> 证据：{conciseEvidenceIds(item.evidenceIds.map(String))}</Text>}</div>)}
                  {guidance.length > 0 && <section><Text strong>后续修改指导</Text><Space direction="vertical" size={4}>{guidance.map((item, index) => <div key={`guidance-${index}`}><Tag color={item.priority === 'high' ? 'red' : item.priority === 'medium' ? 'orange' : 'blue'}>{String(item.priority ?? 'medium')}</Tag><Text strong>{String(item.target ?? '修改位置')}</Text><Text>：{String(item.action ?? '未说明修改动作')}</Text><Text type="secondary"> 原因：{String(item.rationale ?? '-')}；预期：{String(item.expectedImprovement ?? '-')}</Text>{Array.isArray(item.evidenceIds) && <Text type="secondary"> 证据：{conciseEvidenceIds(item.evidenceIds.map(String))}</Text>}</div>)}</Space></section>}
                  {suggestions.length > 0 && <div><Text strong>改进建议</Text><Space direction="vertical" size={2}>{suggestions.map((item, index) => <Text key={`suggestion-${index}`}>{index + 1}. {item}</Text>)}</Space></div>}
                </Space>
              },
              {
                key: 'evidence',
                label: `分析证据 (${evidence.length})`,
                children: evidence.length ? <Collapse
                  size="small"
                  items={evidence.slice(0, 160).map((item) => ({
                    key: item.id,
                    label: `${item.file_name} · ${item.locator} · ${item.modality}`,
                    children: <Space direction="vertical" size={6} className="full-width">
                      <EvidenceArtifact jobId={selected.jobId} item={item} />
                      {item.text && <Text>{item.text.length > 1600 ? `${item.text.slice(0, 1600)}...` : item.text}</Text>}
                      {item.metadata && Object.keys(item.metadata).length > 0 && <pre className="analysis-evidence-metadata">{JSON.stringify(item.metadata, null, 2)}</pre>}
                    </Space>
                  }))}
                /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未生成证据" />
              },
              {
                key: 'warnings',
                label: `文件告警 (${warnings.length})`,
                children: warnings.length ? <Space direction="vertical">{warnings.map((warning, index) => <Text key={`${index}-${warning}`} type="warning">{warning}</Text>)}</Space> : <Text type="secondary">未发现文件解析告警</Text>
              }
            ]}
          />
              </Space>
            }] : [])
          ]} />



        </Space>
      </Card>
    </div>
  </div>;
}

function CourseTasks({ course, onOpenTask }: { course: CourseDetail; onOpenTask: (task: Task) => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task>();
  const [saving, setSaving] = useState(false);
  const [importingDescription, setImportingDescription] = useState(false);
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<TaskForm>();
  const loadTasks = useCallback(async () => {
    try {
      const response = await axios.get<Task[]>(`/api/courses/${course.id}/tasks`);
      setTasks(response.data);
    } catch {
      messageApi.error('作业列表加载失败');
    }
  }, [course.id, messageApi]);
  useEffect(() => { void loadTasks(); }, [loadTasks]);
  function openTaskModal(task?: Task) {
    setEditingTask(task);
    form.setFieldsValue(task ? { title: task.title, description: task.description, deadline: task.deadline ? dayjs(task.deadline) : undefined, status: task.status } : { title: '', description: '', deadline: undefined, status: 'DRAFT' });
    setModalOpen(true);
  }
  async function saveTask() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = { title: values.title, description: values.description, deadline: values.deadline?.toISOString() ?? null, status: 'DRAFT' };
      if (editingTask) await axios.put(`/api/tasks/${editingTask.id}`, { ...payload, status: values.status });
      else await axios.post(`/api/courses/${course.id}/tasks`, payload);
      setModalOpen(false);
      await loadTasks();
    } catch {
      messageApi.error('作业保存失败');
    } finally {
      setSaving(false);
    }
  }
  async function deleteTask(task: Task) {
    try {
      await axios.delete(`/api/tasks/${task.id}`);
      await loadTasks();
      messageApi.success('作业已删除');
    } catch {
      messageApi.error('作业删除失败');
    }
  }
  async function importDescription(file: File) {
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      messageApi.error('作业介绍文件仅支持 PDF 或 Word 格式');
      return;
    }
    const data = new FormData();
    data.append('file', file);
    setImportingDescription(true);
    try {
      const response = await axios.post<{ description: string }>('/api/tasks/description/import', data);
      form.setFieldValue('description', response.data.description);
      messageApi.success('作业介绍已导入');
    } catch {
      messageApi.error('作业介绍导入失败');
    } finally {
      setImportingDescription(false);
    }
  }
  async function batchUpdateStatus(status: TaskStatus) {
    if (selectedIds.length === 0) return;
    setBatchUpdating(true);
    try {
      await axios.put('/api/tasks/batch-status', { taskIds: selectedIds, status });
      setSelectedIds([]);
      await loadTasks();
      messageApi.success(`已更新 ${selectedIds.length} 个作业状态`);
    } catch {
      messageApi.error('批量更新失败');
    } finally {
      setBatchUpdating(false);
    }
  }
  function toggleSelect(id: string) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  }
  function toggleSelectAll() {
    const visible = tasks.filter((task) => task.title.toLowerCase().includes(keyword.trim().toLowerCase()));
    if (selectedIds.length === visible.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visible.map((t) => t.id));
    }
  }
  const visible = tasks.filter((task) => task.title.toLowerCase().includes(keyword.trim().toLowerCase()));
  const allSelected = visible.length > 0 && selectedIds.length === visible.length;
  const batchMenuItems = [
    { key: 'DRAFT', label: '设为草稿', icon: <EditOutlined /> },
    { key: 'ACTIVE', label: '设为进行中', icon: <PlayCircleOutlined /> },
    { key: 'CLOSED', label: '设为已结束', icon: <StopOutlined /> },
  ];
  return <><>{contextHolder}</><Card className="course-task-list" size="small" title={<Space><span>作业</span>{selectedIds.length > 0 && <Tag color="blue">已选 {selectedIds.length} 项</Tag>}</Space>} extra={<Space>{selectedIds.length > 0 && <Dropdown menu={{ items: batchMenuItems, onClick: ({ key }) => void batchUpdateStatus(key as TaskStatus) }}><Button loading={batchUpdating}>批量设置状态</Button></Dropdown>}<Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal()}>新建作业</Button></Space>}>
    <div className="course-task-filters"><Input prefix={<SearchOutlined />} placeholder="搜索作业" value={keyword} onChange={(event) => setKeyword(event.target.value)} className="course-task-search" /></div>
    <div className="course-task-items">
      {visible.length === 0 && <Empty description="暂无作业" />}
      {visible.length > 0 && <div className="course-task-select-all"><Checkbox checked={allSelected} indeterminate={selectedIds.length > 0 && !allSelected} onChange={toggleSelectAll}>全选</Checkbox></div>}
      {visible.map((task) => {
        const desc = task.description || '';
        const truncated = desc.length > 160 ? `${desc.slice(0, 160)}...` : desc;
        return <article className={`course-task-item${selectedIds.includes(task.id) ? ' selected' : ''}`} key={task.id}>
          <Checkbox checked={selectedIds.includes(task.id)} onChange={() => toggleSelect(task.id)} className="course-task-checkbox" />
          <div className="course-task-main">
            <div className="course-task-header">
              <Button className="course-task-title-link" type="link" onClick={() => onOpenTask(task)}>{task.title}</Button>
              <Tag color={statusMeta[task.status].color}>{statusMeta[task.status].label}</Tag>
            </div>
            {desc && <Text className="course-task-desc">{expandedDescriptionIds.includes(task.id) ? desc : truncated}{desc.length > 160 && <Button type="link" size="small" className="course-task-desc-toggle" onClick={() => setExpandedDescriptionIds((ids) => ids.includes(task.id) ? ids.filter((id) => id !== task.id) : [...ids, task.id])}>{expandedDescriptionIds.includes(task.id) ? '收起' : '展开'}</Button>}</Text>}
            <div className="course-task-meta">
              <span>创建于 {new Date(task.createdAt).toLocaleDateString()}</span>
              {task.deadline && <span>截止 {new Date(task.deadline).toLocaleDateString()}</span>}
            </div>
          </div>
          <div className="course-task-actions">
            <Tooltip title="编辑"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openTaskModal(task)} /></Tooltip>
            <Popconfirm title="确定删除？" onConfirm={() => void deleteTask(task)}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
          </div>
        </article>;
      })}
    </div>
  </Card>
  <Modal title={editingTask ? '编辑作业' : '新建作业'} open={modalOpen} confirmLoading={saving} onCancel={() => setModalOpen(false)} onOk={() => void saveTask()}>
    <Form form={form} layout="vertical"><Form.Item name="title" label="作业名称" rules={[{ required: true, message: '请输入作业名称' }]}><Input maxLength={100} /></Form.Item><Form.Item name="description" label="作业介绍" rules={[{ required: true, message: '请输入作业介绍' }]}><Input.TextArea rows={5} maxLength={5000} placeholder="填写作业背景、目标和完成说明" /></Form.Item><Form.Item label="导入作业介绍"><Upload accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" showUploadList={false} beforeUpload={(file) => { void importDescription(file); return Upload.LIST_IGNORE; }}><Button icon={<UploadOutlined />} loading={importingDescription}>导入 PDF 或 Word</Button></Upload></Form.Item><Form.Item name="deadline" label="截止时间"><DatePicker showTime className="full-width" /></Form.Item><Form.Item name="status" label="状态"><Select options={Object.entries(statusMeta).map(([value, item]) => ({ value, label: item.label }))} /></Form.Item></Form>
  </Modal></>;
}

function TaskDetail({ courseId, task, onOpenAnalysis }: {
  courseId: string;
  task: Task;
  onOpenAnalysis: (student: Student, taskId?: string, jobId?: string) => void;
}) {
  const [rule, setRule] = useState<SubmissionRule>();
  const [attachments, setAttachments] = useState<Attachment[]>(task.attachments ?? []);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [ruleExpanded, setRuleExpanded] = useState(false);
  const [scoringRuleExpanded, setScoringRuleExpanded] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [importingRule, setImportingRule] = useState(false);
  const [remindModalOpen, setRemindModalOpen] = useState(false);
  const [remindMessage, setRemindMessage] = useState('');
  const [reminding, setReminding] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [ruleForm] = Form.useForm<RuleForm>();
  const [activeTab, setActiveTab] = useState<string>(() => loadNavState<string>('task-detail-tab', 'detail'));

  const loadRule = useCallback(async () => {
    try {
      const response = await axios.get<SubmissionRule>(`/api/tasks/${task.id}/submission-rule`);
      setRule(response.data);
    } catch {
      messageApi.error('作业提交规则加载失败');
    }
  }, [messageApi, task.id]);

  useEffect(() => { void loadRule(); }, [loadRule]);

  // 保存标签页状态
  useEffect(() => {
    saveNavState('task-detail-tab', activeTab);
  }, [activeTab]);

  function openRuleModal() {
    ruleForm.setFieldsValue({
      allowedExtensions: rule?.allowedExtensions ?? [],
      maxFileSizeMb: Math.max(1, Math.round((rule?.maxFileSizeBytes ?? 50 * 1024 * 1024) / 1024 / 1024)),
      ruleText: rule?.ruleText ?? '',
      scoringRuleText: rule?.scoringRuleText ?? ''
    });
    setRuleModalOpen(true);
  }

  async function saveRule() {
    const values = await ruleForm.validateFields();
    setSavingRule(true);
    try {
      const response = await axios.put<SubmissionRule>(`/api/tasks/${task.id}/submission-rule`, {
        allowedExtensions: values.allowedExtensions ?? [],
        maxFileSizeBytes: Math.round(values.maxFileSizeMb * 1024 * 1024),
        ruleText: values.ruleText.trim() || null,
        scoringRuleText: values.scoringRuleText.trim() || null
      });
      setRule(response.data);
      setRuleModalOpen(false);
      messageApi.success('作业提交规则已保存');
    } catch {
      messageApi.error('作业提交规则保存失败');
    } finally {
      setSavingRule(false);
    }
  }

  async function importRule(file: File) {
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      messageApi.error('规则文件仅支持 PDF 或 DOCX 格式');
      return;
    }
    const data = new FormData();
    data.append('file', file);
    setImportingRule(true);
    try {
      const response = await axios.post<SubmissionRule>(`/api/tasks/${task.id}/submission-rule/import`, data);
      setRule(response.data);
      ruleForm.setFieldValue('ruleText', response.data.ruleText ?? '');
      messageApi.success('规则文件已导入');
    } catch {
      messageApi.error('规则文件导入失败');
    } finally {
      setImportingRule(false);
    }
  }

  async function uploadAttachments(files: File[]) {
    if (files.length === 0) return;
    const uploaded: Attachment[] = [];
    for (const file of files) {
      const data = new FormData();
      data.append('file', file);
      try {
        const response = await axios.post<Attachment>(`/api/tasks/${task.id}/attachments`, data);
        uploaded.push(response.data);
      } catch {
        messageApi.error(`附件“${file.name}”上传失败`);
      }
    }
    if (uploaded.length > 0) {
      setAttachments((items) => [...items, ...uploaded]);
      messageApi.success(`已添加 ${uploaded.length} 个作业附件`);
    }
  }

  async function deleteAttachment(attachment: Attachment) {
    try {
      await axios.delete(attachment.deleteUrl);
      setAttachments((items) => items.filter((item) => item.deleteUrl !== attachment.deleteUrl));
      messageApi.success('作业附件已删除');
    } catch {
      messageApi.error('作业附件删除失败');
    }
  }

  async function remindStudents() {
    setReminding(true);
    try {
      await axios.post(`/api/tasks/${task.id}/remind`, { message: remindMessage.trim() || undefined });
      setRemindModalOpen(false);
      setRemindMessage('');
      messageApi.success('提醒已发送给所有学生');
    } catch {
      messageApi.error('提醒发送失败');
    } finally {
      setReminding(false);
    }
  }

  async function downloadFile(url: string, fileName: string) {
    try {
      const response = await axios.get<Blob>(url, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      messageApi.error('文件下载失败；较早导入的规则文件请重新导入后下载');
    }
  }

  return <div className="course-tasks-page">
    {contextHolder}
    <section className="course-detail-heading">
      <div>
        <Title level={3}>{task.title}</Title>
      </div>
    </section>
    <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
      {
        key: 'detail',
        label: '作业详情',
        children: <Space direction="vertical" size={12} className="full-width">
          <Card className="task-detail-summary" size="small">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="状态"><Tag color={statusMeta[task.status].color}>{statusMeta[task.status].label}</Tag></Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(task.createdAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="截止时间">{task.deadline ? new Date(task.deadline).toLocaleString() : '不设截止时间'}</Descriptions.Item>
              <Descriptions.Item label="操作"><Button icon={<BellOutlined />} onClick={() => setRemindModalOpen(true)}>提醒学生提交</Button></Descriptions.Item>
            </Descriptions>
            <section className="task-detail-text-section"><Text type="secondary">作业介绍</Text><div className="task-detail-long-text">{descriptionExpanded || task.description.length <= 500 ? task.description : `${task.description.slice(0, 500)}...`}{task.description.length > 500 && <Button type="link" size="small" onClick={() => setDescriptionExpanded((value) => !value)}>{descriptionExpanded ? '收起' : '展开'}</Button>}</div></section>
          </Card>
          <Card className="task-detail-summary" size="small" title="作业要求" extra={<Button type="link" onClick={openRuleModal}>编辑要求</Button>}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="允许文件类型" span={2}>{rule?.allowedExtensions.length ? rule.allowedExtensions.join('、') : '不限制'}</Descriptions.Item>
              <Descriptions.Item label="单文件最大大小">{rule ? `${Math.round(rule.maxFileSizeBytes / 1024 / 1024)} MB` : '加载中'}</Descriptions.Item>
              <Descriptions.Item label="导入文件" span={2}>{rule?.importedFileName && rule.importedDownloadUrl ? <Button type="link" icon={<DownloadOutlined />} onClick={() => void downloadFile(rule.importedDownloadUrl!, rule.importedFileName!)}>{rule.importedFileName}</Button> : '无'}</Descriptions.Item>
            </Descriptions>
            <section className="task-detail-text-section"><Text type="secondary">具体要求</Text><div className="task-detail-long-text">{rule?.ruleText ? (ruleExpanded || rule.ruleText.length <= 500 ? rule.ruleText : `${rule.ruleText.slice(0, 500)}...`) : '未设置作业要求'}{rule?.ruleText && rule.ruleText.length > 500 && <Button type="link" size="small" onClick={() => setRuleExpanded((value) => !value)}>{ruleExpanded ? '收起' : '展开'}</Button>}</div></section>
          </Card>
          <Card className="task-detail-summary" size="small" title="评分规则" extra={<Button type="link" onClick={openRuleModal}>编辑评分规则</Button>}>
            <section className="task-detail-text-section"><Text type="secondary">评分标准</Text><div className="task-detail-long-text">{rule?.scoringRuleText ? (scoringRuleExpanded || rule.scoringRuleText.length <= 500 ? rule.scoringRuleText : `${rule.scoringRuleText.slice(0, 500)}...`) : '未设置评分规则'}{rule?.scoringRuleText && rule.scoringRuleText.length > 500 && <Button type="link" size="small" onClick={() => setScoringRuleExpanded((value) => !value)}>{scoringRuleExpanded ? '收起' : '展开'}</Button>}</div></section>
          </Card>
          <Card className="task-detail-summary" size="small" title="作业附件" extra={<Upload multiple showUploadList={false} beforeUpload={(file) => { void uploadAttachments([file]); return Upload.LIST_IGNORE; }}><Button icon={<PaperClipOutlined />}>添加附件</Button></Upload>}>
            {attachments.length ? <Space direction="vertical" size={4}>{attachments.map((attachment) => <Space key={attachment.deleteUrl}><Button type="link" icon={<DownloadOutlined />} onClick={() => void downloadFile(attachment.downloadUrl, attachment.fileName)}>{attachment.fileName}</Button><Popconfirm title={`确定删除附件“${attachment.fileName}”？`} onConfirm={() => void deleteAttachment(attachment)}><Button type="text" danger icon={<DeleteOutlined />} aria-label="删除附件" /></Popconfirm></Space>)}</Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无作业附件" />}
          </Card>
        </Space>
      },
      { key: 'submissions', label: '学生提交', children: <TaskSubmissionTable courseId={courseId} taskId={task.id} onOpenAnalysis={onOpenAnalysis} /> }
    ]} />
    <Modal title="编辑作业要求与评分规则" open={ruleModalOpen} confirmLoading={savingRule} onCancel={() => setRuleModalOpen(false)} onOk={() => void saveRule()}>
      <Form form={ruleForm} layout="vertical">
        <Form.Item name="allowedExtensions" label="允许文件类型"><Select mode="multiple" options={extensionOptions.map((value) => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="maxFileSizeMb" label="单文件最大大小（MB）" rules={[{ required: true, message: '请输入文件大小限制' }]}><InputNumber min={1} max={100} precision={0} /></Form.Item>
        <Form.Item name="ruleText" label="文字规则"><Input.TextArea rows={5} maxLength={2000} placeholder="填写提交格式、命名方式和内容要求" /></Form.Item>
        <Form.Item name="scoringRuleText" label="评分规则"><Input.TextArea rows={5} maxLength={2000} placeholder="填写评分维度、分值和达标要求" /></Form.Item>
        <Form.Item label="导入规则文件">
          <Upload accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" showUploadList={false} beforeUpload={(file) => {
            void importRule(file);
            return Upload.LIST_IGNORE;
          }}>
            <Button icon={<UploadOutlined />} loading={importingRule}>导入 PDF 或 Word</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
    <Modal title="提醒学生提交作业" open={remindModalOpen} confirmLoading={reminding} onCancel={() => setRemindModalOpen(false)} onOk={() => void remindStudents()} okText="发送提醒">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text type="secondary">将向所有选课学生发送提醒通知。</Text>
        <Input.TextArea rows={3} maxLength={200} placeholder="输入提醒内容（可选，默认：请尽快提交作业）" value={remindMessage} onChange={(e) => setRemindMessage(e.target.value)} />
      </Space>
    </Modal>
  </div>;
}

function CourseStudents({ courseId }: { courseId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [options, setOptions] = useState<Student[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [addingGroups, setAddingGroups] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>();
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [members, courseOptions] = await Promise.all([
        axios.get<Student[]>(`/api/courses/${courseId}/students`),
        axios.get<CourseOptions>('/api/courses/options')
      ]);
      setStudents(members.data);
      setOptions(courseOptions.data.students ?? []);
      setGroups(courseOptions.data.groups ?? []);
    } catch {
      messageApi.error('学生名单加载失败');
    } finally {
      setLoading(false);
    }
  }, [courseId, messageApi]);
  useEffect(() => { void load(); }, [load]);
  const available = options.filter((student) => !students.some((member) => member.id === student.id));
  async function addStudent() {
    if (!selectedStudentId) return;
    setAdding(true);
    try {
      await axios.post(`/api/courses/${courseId}/students`, { studentId: selectedStudentId });
      setSelectedStudentId(undefined);
      await load();
      messageApi.success('学生已加入课程');
    } catch {
      messageApi.error('学生加入失败，可能已在课程名单中');
    } finally {
      setAdding(false);
    }
  }
  async function removeStudent(student: Student) {
    try {
      await axios.delete(`/api/courses/${courseId}/students/${student.id}`);
      await load();
      messageApi.success('学生已从课程移除');
    } catch {
      messageApi.error('移除学生失败');
    }
  }
  async function addStudentGroups() {
    if (selectedGroupIds.length === 0) return;
    setAddingGroups(true);
    try {
      const response = await axios.post<Student[]>(`/api/courses/${courseId}/student-groups`, { groupIds: selectedGroupIds });
      setGroupModalOpen(false);
      setSelectedGroupIds([]);
      await load();
      messageApi.success(response.data.length ? `已加入 ${response.data.length} 名学生` : '所选组别的学生已在课程中');
    } catch {
      messageApi.error('按组加入学生失败');
    } finally {
      setAddingGroups(false);
    }
  }
  const columns: ColumnsType<Student> = [
    { title: '学号', dataIndex: 'number', width: 180 },
    { title: '姓名', dataIndex: 'name' },
    { title: '操作', width: 100, render: (_, student) => <Popconfirm title={`确定将 ${student.name} 移出本课程？`} onConfirm={() => void removeStudent(student)}><Button type="link" danger icon={<DeleteOutlined />}>移除</Button></Popconfirm> }
  ];
  return <><Card className="course-student-card" size="small" title="学生名单" extra={<Space wrap><Button icon={<TeamOutlined />} onClick={() => setGroupModalOpen(true)}>按组加入</Button><Select className="course-student-select" showSearch optionFilterProp="label" placeholder="输入学号或姓名搜索" value={selectedStudentId} onChange={setSelectedStudentId} options={available.map((student) => ({ value: student.id, label: `${student.number} ${student.name}` }))} /><Button type="primary" icon={<UserAddOutlined />} disabled={!selectedStudentId} loading={adding} onClick={() => void addStudent()}>加入课程</Button></Space>}>
    {contextHolder}<Table<Student> size="small" rowKey="id" loading={loading} dataSource={students} columns={columns} locale={{ emptyText: <Empty description="暂无课程学生" /> }} pagination={{ pageSize: 8, showSizeChanger: false }} />
  </Card>
  <Modal title="按组加入学生" open={groupModalOpen} confirmLoading={addingGroups} okButtonProps={{ disabled: selectedGroupIds.length === 0 }} onCancel={() => { setGroupModalOpen(false); setSelectedGroupIds([]); }} onOk={() => void addStudentGroups()}>
    <Form layout="vertical"><Form.Item label="学生组别"><Select mode="multiple" showSearch optionFilterProp="label" placeholder="选择一个或多个组别" value={selectedGroupIds} onChange={setSelectedGroupIds} options={groups.map((group) => ({ value: group.id, label: `${group.name}（${group.studentCount} 人）` }))} /></Form.Item></Form>
  </Modal></>;
}
