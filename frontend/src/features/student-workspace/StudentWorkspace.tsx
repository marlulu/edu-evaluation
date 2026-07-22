import { ArrowLeftOutlined, CalendarOutlined, CheckCircleFilled, ClockCircleOutlined, DeleteOutlined, DownloadOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Collapse, Descriptions, Empty, Modal, Space, Tag, Typography, Upload, message } from 'antd';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

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
  };
};
type Course = { id: string; name: string; description: string };
type SubmissionHistory = { id: string; fileName: string; submittedAt: string; downloadUrl: string; archiveEntries: string[] };
type SubmissionBatch = { id: string; submittedAt: string; files: SubmissionHistory[] };
type SubmissionResult = { file: File; success: boolean; reason: string };

function taskIsClosed(task: Task) {
  return task.deadline !== null && new Date(task.deadline).getTime() <= Date.now();
}

function SubmissionHistoryItem({ item, label, onDownload }: { item: SubmissionHistory; label: string; onDownload: (item: SubmissionHistory) => void }) {
  return <div className="student-submission-history-item">
    <div className="student-submission-history-row">
      <div><strong>{label}</strong><Text type="secondary">{new Date(item.submittedAt).toLocaleString()}</Text></div>
      <Button type="link" icon={<DownloadOutlined />} onClick={() => onDownload(item)}>{item.fileName}</Button>
    </div>
    {item.archiveEntries.length > 0 && <Collapse size="small" items={[{
      key: item.id,
      label: `压缩包内容（${item.archiveEntries.length} 个文件）`,
      children: <div className="archive-entry-list">{item.archiveEntries.map((entry) => <Text key={entry} code>{entry}</Text>)}</div>
    }]} />}
  </div>;
}

export function StudentWorkspace({ studentName }: StudentWorkspaceProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task>();
  const [selectedCourse, setSelectedCourse] = useState<Course>();
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

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
        {courses.length ? <Collapse items={courses.map((course) => ({ key: course.id, label: <Space><strong>{course.name}</strong><Tag color="blue">{tasks.filter((task) => task.courseId === course.id && !taskIsClosed(task)).length} 个当前任务</Tag></Space>, extra: <Button type="link" size="small" onClick={(event) => { event.stopPropagation(); setSelectedCourse(course); }}>课程详情</Button>, children: <Space direction="vertical" className="content-stack">{tasks.filter((task) => task.courseId === course.id).map((task) => <Button key={task.id} block type="text" className="student-course-task-link" onClick={() => setSelectedTask(task)}>{task.title}<Tag color={task.submitted ? 'green' : 'blue'}>{task.submitted ? '已提交' : '待提交'}</Tag></Button>)}{!tasks.some((task) => task.courseId === course.id) && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无当前作业" />}</Space> }))} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未加入课程" />}
      </Card>
      {false && <section className="student-task-grid">
        {!loading && tasks.length === 0 && <Empty description="暂无可提交任务" />}
        {tasks.map((task) => {
          const closed = taskIsClosed(task);
          const status = closed ? { label: '已截止', color: 'default', icon: <ClockCircleOutlined /> }
            : task.submitted ? { label: '已提交', color: 'green', icon: <CheckCircleFilled /> }
              : { label: '待提交', color: 'blue', icon: <ClockCircleOutlined /> };
          return (
            <Card key={task.id} className="student-task-card" loading={loading}>
              <Space direction="vertical" size={16} className="content-stack">
                <Tag color={status.color} icon={status.icon}>{status.label}</Tag>
                <div><Text type="secondary">{courses.find((course) => course.id === task.courseId)?.name ?? '课程任务'}</Text><Title level={4}>{task.title}</Title><Paragraph type="secondary" className="student-task-description">{task.description}</Paragraph></div>
                <div className="task-deadline"><CalendarOutlined /><Text type="secondary">{task.deadline ? `截止：${new Date(task.deadline).toLocaleString()}` : '不设截止时间'}</Text></div>
                {task.attachments.map((attachment) => (
                  <Button key={attachment.downloadUrl} type="link" icon={<DownloadOutlined />} href={attachment.downloadUrl}>
                    {attachment.fileName}
                  </Button>
                ))}
                {task.submitted && <Text type="secondary">当前作品：{task.fileName}</Text>}
                <Text type="secondary">
                  {task.submissionRule.allowedExtensions.length
                    ? `允许：${task.submissionRule.allowedExtensions.join('、')}，`
                    : '未限制文件类型，'}
                  最大 {Math.ceil(task.submissionRule.maxFileSizeBytes / 1024 / 1024)} MB
                </Text>
                <Upload beforeUpload={(file) => { void submit(task, [file]); return false; }} showUploadList={false} disabled={closed}>
                  <Button type="primary" block icon={<UploadOutlined />} disabled={closed}>{task.submitted ? '重新提交作品' : '提交作品'}</Button>
                </Upload>
              </Space>
            </Card>
          );
        })}
      </section>}
      <Modal title="课程详情" open={Boolean(selectedCourse)} footer={null} onCancel={() => setSelectedCourse(undefined)}>
        {selectedCourse && <Descriptions column={1} size="small"><Descriptions.Item label="课程名称">{selectedCourse.name}</Descriptions.Item><Descriptions.Item label="课程介绍"><div className="task-detail-long-text">{selectedCourse.description || '暂无课程介绍'}</div></Descriptions.Item><Descriptions.Item label="当前任务">{tasks.filter((task) => task.courseId === selectedCourse.id && !taskIsClosed(task)).length} 个</Descriptions.Item></Descriptions>}
      </Modal>
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
    <Card className="task-detail-summary" size="small" title="提交作业">
      <div className="student-submit-actions"><Text type="secondary">{task.submissionRule.allowedExtensions.length ? `允许文件类型：${task.submissionRule.allowedExtensions.join('、')}` : '不限文件类型'}，最大 {Math.ceil(task.submissionRule.maxFileSizeBytes / 1024 / 1024)} MB</Text>
      <Upload multiple showUploadList={false} beforeUpload={(file) => { setPendingFiles((files) => files.some((item) => item.name === file.name && item.size === file.size) ? files : [...files, file]); setSubmissionResults((results) => results.filter((result) => result.file.name !== file.name || result.file.size !== file.size)); return Upload.LIST_IGNORE; }} disabled={closed}><Button icon={<UploadOutlined />} disabled={closed}>选择文件</Button></Upload></div>
      <div className="student-upload-staging">{pendingFiles.length ? <Space direction="vertical" className="content-stack">{pendingFiles.map((file) => <div className="student-upload-file-row" key={`${file.name}-${file.size}`}><Text>{file.name}（{Math.ceil(file.size / 1024)} KB）</Text><Button type="text" danger icon={<DeleteOutlined />} aria-label={`移除 ${file.name}`} onClick={() => setPendingFiles((files) => files.filter((item) => item !== file))} /></div>)}</Space> : <Text type="secondary">请选择一个或多个文件，确认后统一提交。</Text>}</div>
      {submissionResults.length > 0 && <Space direction="vertical" className="content-stack">{submissionResults.map((result) => <div className="student-upload-file-row" key={`result-${result.file.name}-${result.file.size}`}><Text>{result.file.name}</Text><Tag color="red">{result.reason}</Tag></div>)}</Space>}
      <Button type="primary" icon={<UploadOutlined />} loading={submitting} disabled={closed || pendingFiles.length === 0} onClick={() => void submitPendingFiles()}>{closed ? '已截止' : `确认提交${pendingFiles.length ? `（${pendingFiles.length}）` : ''}`}</Button>
    </Card>
    <Card className="task-detail-summary" size="small" title="教师反馈">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="教师暂未给出反馈" />
    </Card>
    <Card
      className="task-detail-summary"
      size="small"
      title={`我的提交记录（${history.length}）`}
      extra={<Button type="text" size="small" icon={<ReloadOutlined />} loading={historyLoading} onClick={() => void loadHistory()}>刷新</Button>}
    >
      {historyLoading ? <Text type="secondary">加载中...</Text> : history.length ? <Space direction="vertical" className="content-stack">
        <section className="student-current-submission"><div className="student-submission-section-heading"><Tag color="blue">当前版本</Tag><Text strong>当前提交（{history[0].files.length} 个文件）</Text></div>{history[0].files.map((item) => <SubmissionHistoryItem key={item.id} item={item} label={item.fileName} onDownload={(historyItem) => void downloadHistory(historyItem)} />)}</section>
        {history.length > 1 && <section className="student-history-submission"><div className="student-submission-section-heading"><Text type="secondary">历史提交</Text><Tag>{history.length - 1} 次</Tag></div><Collapse size="small" className="student-submission-history-list" items={[{
          key: "previous-submissions",
          label: `查看历史提交（${history.length - 1} 次）`,
          children: <Space direction="vertical" className="content-stack">{history.slice(1).map((batch, index) => (
            <div key={batch.id}><Text type="secondary">{`历史提交 ${history.length - index - 1}（${batch.files.length} 个文件）`}</Text>{batch.files.map((item) => (
              <SubmissionHistoryItem key={item.id} item={item} label={item.fileName} onDownload={(historyItem) => void downloadHistory(historyItem)} />
            ))}</div>
          ))}</Space>
        }]} /></section>}
      </Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未提交作业" />}
    </Card>
  </div>;
}
