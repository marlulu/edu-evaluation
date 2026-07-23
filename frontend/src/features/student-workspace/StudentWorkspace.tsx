import { ArrowLeftOutlined, BookOutlined, CalendarOutlined, CheckCircleFilled, ClockCircleOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, FileTextOutlined, PaperClipOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Collapse, Descriptions, Empty, Input, Space, Statistic, Tag, Typography, Upload, message } from 'antd';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { saveNavState, loadNavState, clearNavState } from '../../navigation-state';
import { FilePreviewModal, isPreviewable } from '../shared/FilePreviewModal';

const { Paragraph, Text, Title } = Typography;

type StudentWorkspaceProps = { studentName: string };
type Task = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  deadline: string | null;
  submitted: boolean;
  fileName: string | null;
  submittedAt: string | null;
  attachments: Array<{ fileName: string; downloadUrl: string }>;
  submissionRule: {
    allowedExtensions: string[];
    maxFileSizeBytes: number;
    ruleText: string | null;
    scoringRuleText: string | null;
  };
  score: number | null;
};
type Course = { id: string; name: string; description: string };
type CourseAttachment = { id: string; fileName: string; downloadUrl: string };
type SubmissionHistory = { id: string; fileName: string; submittedAt: string; downloadUrl: string; archiveEntries: string[] };
type SubmissionBatch = { id: string; submittedAt: string; files: SubmissionHistory[] };
type SubmissionResult = { file: File; success: boolean; reason: string };
type FeedbackData = { ruleScore: number | null; qualityReferenceScore: number | null; comment: string | null; publishedAt: string | null; status: string | null };
type CommentData = { id: string; authorRole: string; authorName: string; content: string; createdAt: string; attachmentFileName: string | null; attachmentUrl: string | null };

function taskIsClosed(task: Task) {
  return task.deadline !== null && new Date(task.deadline).getTime() <= Date.now();
}

function SubmissionHistoryItem({ item, label, onDownload, onPreview, onPreviewEntry }: { item: SubmissionHistory; label: string; onDownload: (item: SubmissionHistory) => void; onPreview: (item: SubmissionHistory) => void; onPreviewEntry: (item: SubmissionHistory, entry: string) => void }) {
  const canPreview = isPreviewable(item.fileName);
  const entries = item.archiveEntries ?? [];
  return <div className="student-submission-history-item">
    <div className="student-submission-history-row">
      <div><strong>{label}</strong><Text type="secondary">{new Date(item.submittedAt).toLocaleString()}</Text></div>
      <Space size={4}>
        {canPreview && <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onPreview(item)}>预览</Button>}
        <Button type="link" icon={<DownloadOutlined />} onClick={() => onDownload(item)}>{item.fileName}</Button>
      </Space>
    </div>
    {entries.length > 0 && <Collapse size="small" defaultActiveKey={[item.id]} items={[{
      key: item.id,
      label: `压缩包内容（${entries.length} 个文件）`,
      children: <div className="archive-entry-list">{entries.map((entry) => {
        const entryFileName = entry.split('/').pop() ?? entry;
        const canPreviewEntry = isPreviewable(entryFileName);
        return <div key={entry} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {canPreviewEntry && <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onPreviewEntry(item, entry)}>预览</Button>}
          <Text code>{entry}</Text>
        </div>;
      })}</div>
    }]} />}
  </div>;
}

export function StudentWorkspace({ studentName }: StudentWorkspaceProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task>();
  const [viewingCourse, setViewingCourse] = useState<Course>();
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const restoredRef = useRef(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const [taskResponse, courseResponse] = await Promise.all([
        axios.get<Task[]>('/api/student/tasks'),
        axios.get<Course[]>('/api/student/courses')
      ]);
      setTasks(taskResponse.data);
      setCourses(courseResponse.data);
    } catch {
      messageApi.error('任务加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  // Restore selected task or course from localStorage after tasks load
  useEffect(() => {
    if (restoredRef.current || loading || tasks.length === 0) return;
    restoredRef.current = true;
    const savedTaskId = loadNavState<string | undefined>('student-task', undefined);
    const savedCourseId = loadNavState<string | undefined>('student-course', undefined);
    if (savedTaskId) {
      const match = tasks.find((t) => t.id === savedTaskId);
      if (match) { setSelectedTask(match); return; }
    }
    if (savedCourseId && courses.length > 0) {
      const match = courses.find((c) => c.id === savedCourseId);
      if (match) setViewingCourse(match);
    }
  }, [loading, tasks, courses]);

  // Persist selected task
  useEffect(() => {
    if (selectedTask) saveNavState('student-task', selectedTask.id);
    else clearNavState('student-task');
  }, [selectedTask]);

  // Persist viewing course
  useEffect(() => {
    if (viewingCourse) saveNavState('student-course', viewingCourse.id);
    else clearNavState('student-course');
  }, [viewingCourse]);

  async function submit(task: Task, files: File[]): Promise<SubmissionResult[]> {
    for (const file of files) {
      const extension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase() ?? ''}` : '';
      if (task.submissionRule.allowedExtensions.length && !task.submissionRule.allowedExtensions.includes(extension)) {
        return files.map((item) => ({ file: item, success: false, reason: `文件类型不符合要求：仅支持 ${task.submissionRule.allowedExtensions.join('、')}` }));
      }
      if (file.size > task.submissionRule.maxFileSizeBytes) {
        return files.map((item) => ({ file: item, success: false, reason: `文件超过最大限制（${Math.ceil(task.submissionRule.maxFileSizeBytes / 1024 / 1024)} MB）` }));
      }
    }
    const body = new FormData();
    files.forEach((file) => body.append('files', file));
    try {
      await axios.post(`/api/student/tasks/${task.id}/submissions`, body);
      return files.map((file) => ({ file, success: true, reason: '提交成功' }));
    } catch (error) {
      let reason = '提交失败，任务可能已截止或网络连接异常';
      if (axios.isAxiosError(error) && typeof error.response?.data === 'object' && error.response.data !== null
        && 'message' in error.response.data && typeof error.response.data.message === 'string') {
        reason = error.response.data.message;
      }
      return files.map((file) => ({ file, success: false, reason }));
    }
  }

  if (selectedTask) {
    return <StudentTaskDetail task={selectedTask} onBack={() => setSelectedTask(undefined)} onSubmit={submit} />;
  }

  if (viewingCourse) {
    const courseTasks = tasks.filter((t) => t.courseId === viewingCourse.id);
    return <StudentCourseDetail
      course={viewingCourse}
      tasks={courseTasks}
      onBack={() => setViewingCourse(undefined)}
      onSelectTask={setSelectedTask}
    />;
  }

  return (
    <div className="student-workspace">
      {contextHolder}
      <section className="page-heading student-heading">
        <div>
          <Tag color="blue">学生工作区</Tag>
          <Title level={2}>我的任务</Title>
          <Paragraph type="secondary">{studentName}，请在截止前提交或更新你的作品。</Paragraph>
        </div>
        <div className="student-summary"><Text type="secondary">待提交任务</Text><strong>{tasks.filter((task) => !task.submitted && !taskIsClosed(task)).length}</strong></div>
      </section>
      <Card size="small" className="student-course-overview" title="我的课程">
        {courses.length ? <Collapse items={courses.map((course) => ({ key: course.id, label: <Space><strong>{course.name}</strong><Tag color="blue">{tasks.filter((task) => task.courseId === course.id && !taskIsClosed(task)).length} 个当前任务</Tag></Space>, extra: <Button type="link" size="small" icon={<BookOutlined />} onClick={(event) => { event.stopPropagation(); setViewingCourse(course); }}>课程详情</Button>, children: <Space direction="vertical" className="content-stack">{tasks.filter((task) => task.courseId === course.id).map((task) => <Button key={task.id} block type="text" className="student-course-task-link" onClick={() => setSelectedTask(task)}>{task.title}<Space size={4}>{task.score != null && <Tag color="purple">{task.score}分</Tag>}<Tag color={task.submitted ? 'green' : 'blue'}>{task.submitted ? '已提交' : '待提交'}</Tag></Space></Button>)}{!tasks.some((task) => task.courseId === course.id) && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无当前作业" />}</Space> }))} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未加入课程" />}
      </Card>
    </div>
  );
}

function StudentCourseDetail({ course, tasks, onBack, onSelectTask }: {
  course: Course;
  tasks: Task[];
  onBack: () => void;
  onSelectTask: (task: Task) => void;
}) {
  const [attachments, setAttachments] = useState<CourseAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const pendingCount = tasks.filter((t) => !t.submitted && !taskIsClosed(t)).length;
  const submittedCount = tasks.filter((t) => t.submitted).length;
  const closedCount = tasks.filter((t) => taskIsClosed(t)).length;

  useEffect(() => {
    setAttachmentsLoading(true);
    axios.get<CourseAttachment[]>(`/api/student/courses/${course.id}/attachments`)
      .then((res) => setAttachments(res.data))
      .catch(() => {})
      .finally(() => setAttachmentsLoading(false));
  }, [course.id]);

  return (
    <div className="student-workspace">
      <section className="page-heading student-heading">
        <div>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>返回我的任务</Button>
          <Title level={2}>{course.name}</Title>
          <Paragraph type="secondary">{course.description || '暂无课程介绍'}</Paragraph>
        </div>
      </section>
      <div className="student-course-stats">
        <Card size="small"><Statistic title="待提交" value={pendingCount} valueStyle={{ color: '#1677ff' }} prefix={<ClockCircleOutlined />} /></Card>
        <Card size="small"><Statistic title="已提交" value={submittedCount} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleFilled />} /></Card>
        <Card size="small"><Statistic title="已截止" value={closedCount} prefix={<CalendarOutlined />} /></Card>
      </div>
      <Card size="small" title="课程附件" className="student-course-task-list">
        {attachmentsLoading ? <Text type="secondary">加载中...</Text>
          : attachments.length ? <Space direction="vertical" className="content-stack">
              {attachments.map((att) => (
                <Button key={att.id} type="link" icon={<DownloadOutlined />} href={att.downloadUrl}>{att.fileName}</Button>
              ))}
            </Space>
          : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无课程附件" />}
      </Card>
      <Card size="small" title="课程作业" className="student-course-task-list">
        {tasks.length ? <Space direction="vertical" className="content-stack" style={{ width: '100%' }}>
          {tasks.map((task) => {
            const closed = taskIsClosed(task);
            return <div key={task.id} className="student-course-task-item">
              <div className="student-course-task-info">
                <Button type="link" icon={<FileTextOutlined />} onClick={() => onSelectTask(task)}>{task.title}</Button>
                <Text type="secondary">{task.deadline ? `截止：${new Date(task.deadline).toLocaleDateString()}` : '不设截止时间'}</Text>
              </div>
              <Space size={4}>{task.score != null && <Tag color="purple">{task.score}分</Tag>}<Tag color={closed ? 'default' : task.submitted ? 'green' : 'blue'}>{closed ? '已截止' : task.submitted ? '已提交' : '待提交'}</Tag></Space>
            </div>;
          })}
        </Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无作业" />}
      </Card>
    </div>
  );
}

function StudentTaskDetail({ task, onBack, onSubmit }: { task: Task; onBack: () => void; onSubmit: (task: Task, files: File[]) => Promise<SubmissionResult[]> }) {
  const closed = taskIsClosed(task);
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submissionResults, setSubmissionResults] = useState<SubmissionResult[]>([]);
  const [history, setHistory] = useState<SubmissionBatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [commentExpanded, setCommentExpanded] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewArchiveEntry, setPreviewArchiveEntry] = useState<string | undefined>(undefined);
  const [messageApi, contextHolder] = message.useMessage();
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await axios.get<SubmissionBatch[]>(`/api/student/tasks/${task.id}/submissions`, {
        params: { _: Date.now() }
      });
      setHistory(response.data);
    } catch {
      messageApi.error('提交记录加载失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [messageApi, task.id]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);
  useEffect(() => {
    setFeedbackLoading(true);
    axios.get<FeedbackData>(`/api/student/tasks/${task.id}/feedback`)
      .then((res) => setFeedback(res.data))
      .catch(() => {})
      .finally(() => setFeedbackLoading(false));
  }, [task.id]);
  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await axios.get<CommentData[]>(`/api/student/tasks/${task.id}/comments`);
      setComments(res.data);
    } catch { /* ignore */ }
    finally { setCommentsLoading(false); }
  }, [task.id]);
  useEffect(() => { void loadComments(); }, [loadComments]);
  async function sendComment() {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      const form = new FormData();
      form.append('content', commentText.trim());
      if (commentFile) form.append('file', commentFile);
      await axios.post(`/api/student/tasks/${task.id}/comments`, form);
      setCommentText('');
      setCommentFile(null);
      void loadComments();
    } catch {
      messageApi.error('留言发送失败');
    } finally {
      setSendingComment(false);
    }
  }
  async function downloadHistory(item: SubmissionHistory) {
    try {
      const response = await axios.get<Blob>(item.downloadUrl, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      messageApi.error('提交文件下载失败');
    }
  }
  function openPreview(item: SubmissionHistory) {
    setPreviewId(item.id);
    setPreviewFileName(item.fileName);
    setPreviewArchiveEntry(undefined);
    setPreviewOpen(true);
  }
  function openArchivePreview(item: SubmissionHistory, entry: string) {
    setPreviewId(item.id);
    setPreviewFileName(item.fileName);
    setPreviewArchiveEntry(entry);
    setPreviewOpen(true);
  }
  async function submitPendingFiles() {
    if (pendingFiles.length === 0) {
      messageApi.warning('请先选择需要提交的文件');
      return;
    }
    setSubmitting(true);
    try {
      const results = await onSubmit(task, pendingFiles);
      const failedFiles = results.filter((result) => !result.success).map((result) => result.file);
      setSubmissionResults(results.filter((result) => !result.success));
      setPendingFiles(failedFiles);
      const submittedCount = results.filter((result) => result.success).length;
      if (submittedCount > 0) {
        await loadHistory();
        messageApi.success(`已提交 ${submittedCount} 个文件${failedFiles.length ? `，${failedFiles.length} 个文件未成功` : ''}`);
      } else {
        messageApi.error('所选文件均未提交成功，请查看失败原因');
      }
    } finally {
      setSubmitting(false);
    }
  }
  return <div className="student-workspace">
    {contextHolder}
    <section className="page-heading student-heading"><div><Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>返回课程</Button><Title level={2}>{task.title}</Title></div></section>
    <Card className="task-detail-summary" size="small">
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="截止时间">{task.deadline ? new Date(task.deadline).toLocaleString() : '不设截止时间'}</Descriptions.Item>
        <Descriptions.Item label="提交状态"><Tag color={task.submitted ? 'green' : 'blue'}>{task.submitted ? '已提交' : '待提交'}</Tag></Descriptions.Item>
      </Descriptions>
      <section className="task-detail-text-section"><Text type="secondary">作业介绍</Text><div className={`task-detail-long-text ${descriptionExpanded ? '' : 'task-detail-long-text-collapsed'}`}>{task.description}</div>{task.description.length > 500 && <Button type="link" size="small" onClick={() => setDescriptionExpanded((expanded) => !expanded)}>{descriptionExpanded ? '收起介绍' : '展开介绍'}</Button>}</section>
    </Card>
    <Card className="task-detail-summary" size="small" title="作业附件">
      {task.attachments.length ? <Space direction="vertical">{task.attachments.map((attachment) => <Button key={attachment.downloadUrl} type="link" icon={<DownloadOutlined />} href={attachment.downloadUrl}>{attachment.fileName}</Button>)}</Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无作业附件" />}
    </Card>
    {(task.submissionRule.ruleText || task.submissionRule.scoringRuleText) && <Card className="task-detail-summary" size="small" title="作业要求与评分规则">
      <Space direction="vertical" size={16} className="full-width">
        {task.submissionRule.ruleText && <section><Text strong>作业要求</Text><div className="task-detail-long-text">{task.submissionRule.ruleText}</div></section>}
        {task.submissionRule.scoringRuleText && <section><Text strong>评分规则</Text><div className="task-detail-long-text">{task.submissionRule.scoringRuleText}</div></section>}
      </Space>
    </Card>}
    <Card className="task-detail-summary" size="small" title="提交作业">
      <div className="student-submit-actions"><Text type="secondary">{task.submissionRule.allowedExtensions.length ? `允许文件类型：${task.submissionRule.allowedExtensions.join('、')}` : '不限文件类型'}，最大 {Math.ceil(task.submissionRule.maxFileSizeBytes / 1024 / 1024)} MB</Text>
      <Upload multiple showUploadList={false} beforeUpload={(file) => { setPendingFiles((files) => files.some((item) => item.name === file.name && item.size === file.size) ? files : [...files, file]); setSubmissionResults((results) => results.filter((result) => result.file.name !== file.name || result.file.size !== file.size)); return Upload.LIST_IGNORE; }} disabled={closed}><Button icon={<UploadOutlined />} disabled={closed}>选择文件</Button></Upload></div>
      <div className="student-upload-staging">{pendingFiles.length ? <Space direction="vertical" className="content-stack">{pendingFiles.map((file) => <div className="student-upload-file-row" key={`${file.name}-${file.size}`}><Text>{file.name}（{Math.ceil(file.size / 1024)} KB）</Text><Button type="text" danger icon={<DeleteOutlined />} aria-label={`移除 ${file.name}`} onClick={() => setPendingFiles((files) => files.filter((item) => item !== file))} /></div>)}</Space> : <Text type="secondary">请选择一个或多个文件，确认后统一提交。</Text>}</div>
      {submissionResults.length > 0 && <Space direction="vertical" className="content-stack">{submissionResults.map((result) => <div className="student-upload-file-row" key={`result-${result.file.name}-${result.file.size}`}><Text>{result.file.name}</Text><Tag color="red">{result.reason}</Tag></div>)}</Space>}
      <Button type="primary" icon={<UploadOutlined />} loading={submitting} disabled={closed || pendingFiles.length === 0} onClick={() => void submitPendingFiles()}>{closed ? '已截止' : `确认提交${pendingFiles.length ? `（${pendingFiles.length}）` : ''}`}</Button>
    </Card>
    <Card className="task-detail-summary" size="small" title="教师反馈">
      {feedbackLoading ? <Text type="secondary">加载中...</Text> : feedback && feedback.status === 'PUBLISHED' ? (
        <>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="规则得分">{feedback.ruleScore ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="AI参考分">{feedback.qualityReferenceScore ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="发布时间">{feedback.publishedAt ? new Date(feedback.publishedAt).toLocaleString() : '-'}</Descriptions.Item>
          </Descriptions>
          <section className="task-detail-text-section">
            <Text type="secondary">教师评语</Text>
            <div className={`task-detail-long-text ${commentExpanded ? '' : 'task-detail-long-text-collapsed'}`}>{feedback.comment || '无评语'}</div>
            {(feedback.comment?.length ?? 0) > 200 && <Button type="link" size="small" onClick={() => setCommentExpanded((v) => !v)}>{commentExpanded ? '收起评语' : '展开评语'}</Button>}
          </section>
          {!closed && <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>评语已发布，你可以在截止时间前重新提交作业。</Text>}
        </>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="教师暂未发布反馈" />}
    </Card>
    <Card className="task-detail-summary" size="small" title={`留言交流（${comments.length}）`}>
      {commentsLoading ? <Text type="secondary">加载中...</Text> : <>
        <Space direction="vertical" size={8} className="full-width">
          {comments.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无留言" />}
          {comments.map((c) => <div key={c.id} className={`comment-item comment-${c.authorRole.toLowerCase()}`}>
            <div className="comment-header"><Tag color={c.authorRole === 'TEACHER' ? 'orange' : 'blue'}>{c.authorRole === 'TEACHER' ? '教师' : '学生'}</Tag><Text strong>{c.authorName}</Text><Text type="secondary" className="comment-time">{new Date(c.createdAt).toLocaleString()}</Text></div>
            <div className="comment-content">{c.content}</div>
            {c.attachmentFileName && c.attachmentUrl && <div className="comment-attachment"><Button type="link" size="small" icon={<PaperClipOutlined />} href={c.attachmentUrl}>{c.attachmentFileName}</Button></div>}
          </div>)}
        </Space>
        <div style={{ marginTop: 12 }}>
          <Input.TextArea rows={2} maxLength={2000} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="输入留言内容..." onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); void sendComment(); } }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Upload showUploadList={false} beforeUpload={(file) => { setCommentFile(file); return Upload.LIST_IGNORE; }}>
              <Button size="small" icon={<PaperClipOutlined />}>{commentFile ? commentFile.name : '添加附件'}</Button>
            </Upload>
            {commentFile && <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setCommentFile(null)} />}
            <Button type="primary" size="small" loading={sendingComment} disabled={!commentText.trim()} onClick={() => void sendComment()}>发送</Button>
          </div>
        </div>
      </>}
    </Card>
    <Card
      className="task-detail-summary"
      size="small"
      title={`我的提交记录（${history.length}）`}
      extra={<Button type="text" size="small" icon={<ReloadOutlined />} loading={historyLoading} onClick={() => void loadHistory()}>刷新</Button>}
    >
      {historyLoading ? <Text type="secondary">加载中...</Text> : history.length ? <Space direction="vertical" className="content-stack">
        <section className="student-current-submission">
          <div className="student-submission-section-heading"><Tag color="blue">当前版本</Tag><Text strong>当前提交（{history[0].files.length} 个文件）</Text></div>
          {history[0].files.map((item) => <SubmissionHistoryItem key={item.id} item={item} label={item.fileName} onDownload={(historyItem) => void downloadHistory(historyItem)} onPreview={openPreview} onPreviewEntry={openArchivePreview} />)}
        </section>
        {history.length > 1 && <section className="student-history-submission"><div className="student-submission-section-heading"><Text type="secondary">历史提交</Text><Tag>{history.length - 1} 次</Tag></div><Collapse size="small" className="student-submission-history-list" items={[{
          key: "previous-submissions",
          label: `查看历史提交（${history.length - 1} 次）`,
          children: <Space direction="vertical" className="content-stack">{history.slice(1).map((batch, index) => (
            <div key={batch.id}><Text type="secondary">{`历史提交 ${history.length - index - 1}（${batch.files.length} 个文件）`}</Text>{batch.files.map((item) => (
              <SubmissionHistoryItem key={item.id} item={item} label={item.fileName} onDownload={(historyItem) => void downloadHistory(historyItem)} onPreview={openPreview} onPreviewEntry={openArchivePreview} />
            ))}</div>
          ))}</Space>
        }]} /></section>}
      </Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未提交作业" />}
    </Card>
    <FilePreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} submissionId={previewId} fileName={previewFileName} archiveEntry={previewArchiveEntry} />
  </div>;
}
