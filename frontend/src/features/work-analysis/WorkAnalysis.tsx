import ReactMarkdown from 'react-markdown';
import {
  AudioOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  UploadOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  List,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
  message
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  type WorkAnalysisResult,
  type WorkTaskStatus,
  analyzeWorkAsync,
  deleteWorkTask,
  getWorkCapabilities,
  getWorkTaskStatus,
  listWorkTasks,
  uploadWork,
  uploadCriteria,
  parseCriteriaFile
} from './api';

const { Paragraph, Text, Title } = Typography;

const statusLabels: Record<WorkTaskStatus, string> = {
  pending: '等待中',
  preprocessing: '预处理中',
  extracting_metadata: '提取元数据',
  extracting_keyframes: '提取关键帧',
  extracting_audio: '提取音频',
  transcribing: '语音识别中',
  analyzing_content: '分析内容中',
  completed: '分析完成',
  failed: '分析失败',
};

const statusColors: Record<WorkTaskStatus, string> = {
  pending: 'default',
  preprocessing: 'processing',
  extracting_metadata: 'processing',
  extracting_keyframes: 'processing',
  extracting_audio: 'processing',
  transcribing: 'processing',
  analyzing_content: 'processing',
  completed: 'success',
  failed: 'error',
};

const stageOrder: WorkTaskStatus[] = [
  'pending',
  'preprocessing',
  'extracting_metadata',
  'extracting_keyframes',
  'extracting_audio',
  'transcribing',
  'analyzing_content',
  'completed',
];

export function WorkAnalysis() {
  const [apiMessage, contextHolder] = message.useMessage();
  const [tasks, setTasks] = useState<WorkAnalysisResult[]>([]);
  const [selectedTask, setSelectedTask] = useState<WorkAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | undefined>();
  const [criteriaFile, setCriteriaFile] = useState<File | undefined>();
  const [criteriaText, setCriteriaText] = useState<string | undefined>();
  const [criteriaParsing, setCriteriaParsing] = useState(false);
  const [form] = Form.useForm();

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listWorkTasks();
      const taskList = result.tasks as WorkAnalysisResult[];
      setTasks(taskList);

      // 自动选中第一个任务或更新已选中的任务
      if (taskList.length > 0) {
        setSelectedTask((current) => {
          if (current) {
            const updated = taskList.find((t) => t.taskId === current.taskId);
            return updated || taskList[0];
          }
          return taskList[0];
        });
      }
    } catch (error) {
      apiMessage.error('加载任务列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCapabilities = useCallback(async () => {
    try {
      const caps = await getWorkCapabilities();
      setCapabilities(caps);
    } catch (error) {
      console.error('加载能力信息失败:', error);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadCapabilities();
  }, [loadTasks, loadCapabilities]);

  // 自动刷新：当有任务在处理中时，每 3 秒刷新任务列表
  useEffect(() => {
    const hasProcessingTasks = tasks.some(
      (t) => !['completed', 'failed'].includes(t.status)
    );
    if (!hasProcessingTasks) return;

    const timer = setInterval(() => {
      loadTasks();
    }, 3000);

    return () => clearInterval(timer);
  }, [tasks, loadTasks]);

  // 独立刷新选中任务的详细信息
  useEffect(() => {
    if (!selectedTask || ['completed', 'failed'].includes(selectedTask.status)) return;

    const timer = setInterval(async () => {
      try {
        const detail = await getWorkTaskStatus(selectedTask.taskId);
        setSelectedTask(detail);
        // 同步更新列表中的状态和进度
        setTasks((prev) =>
          prev.map((t) =>
            t.taskId === detail.taskId
              ? { ...t, status: detail.status, progress: detail.progress }
              : t
          )
        );
      } catch {
        // 静默忽略，下次重试
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [selectedTask?.taskId, selectedTask?.status]);

  const handleSelectTask = async (task: WorkAnalysisResult) => {
    // 先设置摘要信息，立即显示
    setSelectedTask(task);
    // 如果任务已完成或失败，加载完整详情
    if (task.status === 'completed' || task.status === 'failed') {
      try {
        const detail = await getWorkTaskStatus(task.taskId);
        setSelectedTask(detail);
      } catch {
        // 加载失败，保留摘要信息
      }
    }
  };

  const handleCriteriaFileChange = async (file: File | undefined) => {
    setCriteriaFile(file);
    setCriteriaText(undefined);
    if (!file) return;

    setCriteriaParsing(true);
    try {
      const uploadResult = await uploadCriteria(file);
      if (uploadResult.success && uploadResult.filePath) {
        const parseResult = await parseCriteriaFile(uploadResult.filePath);
        if (parseResult.success && parseResult.text) {
          setCriteriaText(parseResult.text);
        } else {
          apiMessage.warning('评判标准文件解析失败');
        }
      }
    } catch (error) {
      console.error('解析评判标准文件失败:', error);
      apiMessage.warning('评判标准文件解析失败');
    } finally {
      setCriteriaParsing(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteWorkTask(taskId);
      apiMessage.success('任务已删除');
      if (selectedTask?.taskId === taskId) {
        setSelectedTask(null);
      }
      loadTasks();
    } catch (error) {
      apiMessage.error('删除任务失败');
    }
  };

  const handleSubmitAnalysis = async () => {
    try {
      const values = await form.validateFields();
      if (!uploadFile) {
        apiMessage.error('请先选择视频文件');
        return;
      }

      setUploading(true);

      // 1. 上传视频文件
      const uploadResult = await uploadWork(uploadFile);
      if (!uploadResult.success || !uploadResult.filePath) {
        apiMessage.error(uploadResult.message || '文件上传失败');
        return;
      }

      // 2. 评判标准已在上传时解析完毕，直接使用 criteriaText 状态

      // 3. 提交分析任务
      const result = await analyzeWorkAsync({
        fileName: uploadResult.fileName || uploadFile.name,
        filePath: uploadResult.filePath,
        criteriaText: criteriaText,
        options: {
          extractKeyframes: true,
          transcribeAudio: true,
          analyzeContent: true,
          ocrEnabled: true,
          maxKeyframes: values.maxKeyframes || 15,
        },
      });

      apiMessage.success('分析任务已提交');
      setUploadModalOpen(false);
      setUploadFile(undefined);
      setCriteriaFile(undefined);
      setCriteriaText(undefined);
      form.resetFields();

      // 立即将新任务插入列表并选中
      const newTask = {
        taskId: result.taskId,
        fileName: uploadResult.fileName || uploadFile.name,
        status: 'pending' as WorkTaskStatus,
        progress: 0,
      } as WorkAnalysisResult;
      setTasks((prev) => [newTask, ...prev]);
      setSelectedTask(newTask);
    } catch (error: any) {
      if (error?.errorFields) return; // 表单校验失败
      apiMessage.error('提交失败: ' + (error?.message || '未知错误'));
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <Space align="start" className="toolbar-row" style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Title level={2} style={{ marginBottom: 0 }}>
            <FileOutlined /> 作品分析
          </Title>
          <Paragraph type="secondary">
            上传视频文件，系统将自动进行元数据提取、关键帧提取、语音识别和内容分析。
          </Paragraph>
        </div>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => setUploadModalOpen(true)}
        >
          上传视频
        </Button>
      </Space>

      <Row gutter={24}>
        {/* 左侧：任务列表 */}
        <Col span={8}>
          <Card
            title="分析任务"
            extra={
              <Button icon={<ReloadOutlined />} onClick={loadTasks} loading={loading}>
                刷新
              </Button>
            }
          >
            {tasks.length === 0 ? (
              <Empty description="暂无分析任务" />
            ) : (
              <List
                dataSource={tasks}
                renderItem={(task) => (
                  <List.Item
                    key={task.taskId}
                    actions={[
                      <Button
                        key="delete"
                        type="link"
                        danger
                        onClick={() => handleDeleteTask(task.taskId)}
                      >
                        删除
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        task.status === 'completed' ? (
                          <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                        ) : task.status === 'failed' ? (
                          <CloseCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                        ) : (
                          <LoadingOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                        )
                      }
                      title={
                        <a onClick={() => handleSelectTask(task)}>
                          {task.fileName}
                        </a>
                      }
                      description={
                        <Space direction="vertical" size={4}>
                          <Tag color={statusColors[task.status]}>
                            {statusLabels[task.status]}
                          </Tag>
                          {task.status !== 'completed' && task.status !== 'failed' && (
                            <Progress percent={task.progress} size="small" />
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          {/* 能力信息 */}
          {capabilities && (
            <Card title="支持的功能" style={{ marginTop: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="支持格式">
                  {(capabilities.supported_formats || capabilities.supportedFormats || []).join(', ')}
                </Descriptions.Item>
                <Descriptions.Item label="最大时长">
                  {(capabilities.max_duration_seconds || capabilities.maxDurationSeconds || 0) / 60} 分钟
                </Descriptions.Item>
                <Descriptions.Item label="最大文件">
                  {capabilities.max_file_size_mb || capabilities.maxFileSizeMb || 0} MB
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Col>

        {/* 右侧：任务详情 */}
        <Col span={16}>
          {selectedTask ? (
            <TaskDetail
              task={selectedTask}
              formatDuration={formatDuration}
              formatFileSize={formatFileSize}
            />
          ) : (
            <Card>
              <Empty description="选择一个任务查看详情" />
            </Card>
          )}
        </Col>
      </Row>

      {/* 上传分析弹窗 */}
      <Modal
        title="上传视频并分析"
        open={uploadModalOpen}
        onOk={handleSubmitAnalysis}
        onCancel={() => {
          setUploadModalOpen(false);
          setUploadFile(undefined);
          setCriteriaFile(undefined);
          setCriteriaText(undefined);
          setCriteriaParsing(false);
          form.resetFields();
        }}
        confirmLoading={uploading}
        okText="提交分析"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" initialValues={{ maxKeyframes: 15 }}>
          <Form.Item label="视频文件" required>
            <Upload.Dragger
              multiple={false}
              maxCount={1}
              accept=".mp4,.avi,.mov,.mkv,.webm"
              fileList={uploadFile ? [{ uid: uploadFile.name, name: uploadFile.name, status: 'done' }] : []}
              beforeUpload={(file) => {
                setUploadFile(file);
                return false;
              }}
              onRemove={() => setUploadFile(undefined)}
            >
              <p style={{ fontSize: 32, color: '#1890ff' }}><UploadOutlined /></p>
              <p>点击或拖拽视频文件到此区域</p>
              <p style={{ color: '#999' }}>支持 MP4, AVI, MOV, MKV, WebM 格式</p>
            </Upload.Dragger>
          </Form.Item>

          <Form.Item name="maxKeyframes" label="最大关键帧数">
            <Select
              options={[
                { value: 10, label: '10 帧' },
                { value: 15, label: '15 帧' },
                { value: 20, label: '20 帧' },
                { value: 30, label: '30 帧' },
              ]}
            />
          </Form.Item>

          <Form.Item label="评判标准文件（可选，留空使用内置默认标准）">
            <Upload.Dragger
              multiple={false}
              maxCount={1}
              accept=".pdf,.docx,.doc,.txt"
              fileList={criteriaFile ? [{ uid: criteriaFile.name, name: criteriaFile.name, status: 'done' }] : []}
              beforeUpload={(file) => {
                handleCriteriaFileChange(file);
                return false;
              }}
              onRemove={() => {
                setCriteriaFile(undefined);
                setCriteriaText(undefined);
              }}
            >
              <p style={{ fontSize: 24, color: '#1890ff' }}><UploadOutlined /></p>
              <p>点击或拖拽评判标准文件到此区域</p>
              <p style={{ color: '#999' }}>支持 PDF, Word (.docx), 文本 (.txt) 格式</p>
            </Upload.Dragger>
            {criteriaParsing && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <LoadingOutlined style={{ marginRight: 8 }} />
                <Text type="secondary">正在解析评判标准文件...</Text>
              </div>
            )}
            {criteriaText && !criteriaParsing && (
              <Card
                size="small"
                title="评判标准预览"
                style={{ marginTop: 12, maxHeight: 300, overflow: 'auto' }}
                extra={<Tag color="green">解析成功</Tag>}
              >
                <Paragraph
                  style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13 }}
                  ellipsis={{ rows: 8, expandable: true, symbol: '展开' }}
                >
                  {criteriaText}
                </Paragraph>
              </Card>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// 任务详情组件
function TaskDetail({
  task,
  formatDuration,
  formatFileSize,
}: {
  task: WorkAnalysisResult;
  formatDuration: (seconds: number) => string;
  formatFileSize: (bytes: number) => string;
}) {
  // 计算 Steps 组件的当前步骤（排除 pending 和 completed）
  const stepsStages = stageOrder.slice(1, -1);
  const currentStep = stepsStages.indexOf(task.status);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* 基本信息 */}
      <Card title="任务信息">
        <Descriptions column={2}>
          <Descriptions.Item label="文件名">{task.fileName}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColors[task.status]}>{statusLabels[task.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="进度">
            <Progress percent={task.progress} status="active" />
          </Descriptions.Item>
          <Descriptions.Item label="处理时间">
            {task.processingTimeMs
              ? `${(task.processingTimeMs / 1000).toFixed(1)} 秒`
              : '-'}
          </Descriptions.Item>
        </Descriptions>

        {/* 进度步骤 */}
        <Steps
          current={currentStep}
          size="small"
          style={{ marginTop: 16 }}
          status={task.status === 'failed' ? 'error' : task.status === 'completed' ? 'finish' : 'process'}
          items={stepsStages.map((stage) => ({
            title: statusLabels[stage],
          }))}
        />

        {task.error && (
          <div style={{ marginTop: 16, color: '#ff4d4f' }}>
            <Text type="danger">错误：{task.error}</Text>
          </div>
        )}
      </Card>

      {/* 视频元数据 */}
      {task.metadata && (
        <Card title="视频信息">
          <Descriptions column={2}>
            <Descriptions.Item label="时长">
              {formatDuration((task.metadata as any).durationSeconds ?? (task.metadata as any).duration_seconds ?? 0)}
            </Descriptions.Item>
            <Descriptions.Item label="分辨率">
              {task.metadata.width} × {task.metadata.height}
            </Descriptions.Item>
            <Descriptions.Item label="帧率">
              {(task.metadata.fps ?? 0).toFixed(1)} fps
            </Descriptions.Item>
            <Descriptions.Item label="编码">{task.metadata.codec}</Descriptions.Item>
            <Descriptions.Item label="文件大小">
              {formatFileSize((task.metadata as any).fileSize ?? (task.metadata as any).file_size ?? 0)}
            </Descriptions.Item>
            <Descriptions.Item label="音频">
              {((task.metadata as any).hasAudio ?? (task.metadata as any).has_audio) ? (
                <Tag color="green">有音频</Tag>
              ) : (
                <Tag color="default">无音频</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 技术质量 */}
      {task.technicalQuality && (
        <Card title="技术质量评估">
          <Descriptions column={2}>
            <Descriptions.Item label="视频质量">
              <Tag>{(task.technicalQuality as any).videoQuality ?? (task.technicalQuality as any).video_quality}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="音频质量">
              <Tag>{(task.technicalQuality as any).audioQuality ?? (task.technicalQuality as any).audio_quality}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="稳定性">
              <Tag>{task.technicalQuality.stability}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="综合评分">
              <Progress
                percent={(task.technicalQuality as any).overallScore ?? (task.technicalQuality as any).overall_score}
                size="small"
                style={{ width: 120 }}
              />
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 关键帧 */}
      {task.keyframes && task.keyframes.length > 0 && (
        <Card title={`关键帧 (${task.keyframes.length} 帧)`}>
          <Row gutter={[16, 16]}>
            {task.keyframes.slice(0, 12).map((frame: any) => (
              <Col key={frame.frameId ?? frame.frame_id} span={4}>
                <Card
                  hoverable
                  size="small"
                  cover={
                    (frame.imageBase64 ?? frame.image_base64 ?? frame.imagePath ?? frame.image_path) ? (
                      <Image
                        src={frame.imageBase64 ?? frame.image_base64 ?? frame.imagePath ?? frame.image_path}
                        alt={`帧 ${frame.frameIndex ?? frame.frame_index}`}
                        style={{ height: 80, objectFit: 'cover' }}
                        preview={true}
                      />
                    ) : (
                      <div
                        style={{
                          height: 80,
                          background: '#f0f0f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <PlayCircleOutlined style={{ fontSize: 24 }} />
                      </div>
                    )
                  }
                >
                  <Card.Meta
                    title={
                      <Text style={{ fontSize: 12 }}>
                        {formatDuration(frame.timestampSeconds ?? frame.timestamp_seconds ?? 0)}
                      </Text>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
          {task.keyframes.length > 12 && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <Text type="secondary">还有 {task.keyframes.length - 12} 帧...</Text>
            </div>
          )}
        </Card>
      )}

      {/* 语音转录 */}
      {task.audioAnalysis && (task.audioAnalysis as any).transcription?.length > 0 && (
        <Card
          title={
            <Space>
              <AudioOutlined />
              <span>语音转录</span>
              <Tag>{((task.audioAnalysis as any).detectedLanguage ?? (task.audioAnalysis as any).detected_language) === 'zh' ? '中文' : '英文'}</Tag>
            </Space>
          }
          extra={
            <Space>
              <Text type="secondary">
                语速：{((task.audioAnalysis as any).averageSpeechRate ?? (task.audioAnalysis as any).average_speech_rate ?? 0).toFixed(0)} 字/分钟
              </Text>
              {((task.audioAnalysis as any).clarityScore ?? (task.audioAnalysis as any).clarity_score) && (
                <Text type="secondary">
                  清晰度：{(((task.audioAnalysis as any).clarityScore ?? (task.audioAnalysis as any).clarity_score) * 100).toFixed(0)}%
                </Text>
              )}
            </Space>
          }
        >
          <Table
            dataSource={(task.audioAnalysis as any).transcription}
            rowKey={(record: any) => `${record.startTime ?? record.start_time}-${record.endTime ?? record.end_time}`}
            size="small"
            pagination={{ pageSize: 10 }}
            columns={[
              {
                key: 'time',
                title: '时间',
                width: 120,
                render: (_: any, record: any) => (
                  <Text type="secondary">
                    {formatDuration(record.startTime ?? record.start_time ?? 0)} - {formatDuration(record.endTime ?? record.end_time ?? 0)}
                  </Text>
                ),
              },
              {
                key: 'text',
                title: '内容',
                dataIndex: 'text',
              },
              {
                key: 'confidence',
                title: '置信度',
                width: 100,
                render: (_: any, record: any) =>
                  record.confidence ? (
                    <Progress
                      percent={Math.round(record.confidence * 100)}
                      size="small"
                      showInfo={false}
                    />
                  ) : (
                    '-'
                  ),
              },
            ]}
          />
        </Card>
      )}

      {/* 内容分析 */}
      {task.contentAnalysis && (
        <ContentAnalysisView analysis={task.contentAnalysis} />
      )}

      {/* 警告信息 */}
      {task.warnings && task.warnings.length > 0 && (
        <Card title="警告信息">
          {task.warnings.map((warning, index) => (
            <div key={index} style={{ color: '#faad14' }}>
              ⚠️ {warning}
            </div>
          ))}
        </Card>
      )}
    </Space>
  );
}

// 评分等级颜色
function getGradeColor(grade: string): string {
  if (grade.includes('优秀')) return '#52c41a';
  if (grade.includes('良好')) return '#1890ff';
  if (grade.includes('合格') || grade.includes('中等') || grade.includes('及格')) return '#faad14';
  return '#ff4d4f';
}

// 评分结果展示组件
function EvaluationView({ evaluation }: { evaluation: any }) {
  const totalScore = evaluation.totalScore ?? evaluation.total_score ?? 0;
  const grade = evaluation.grade ?? '';
  const scores: any[] = evaluation.scores ?? [];
  const strengths: string[] = evaluation.strengths ?? [];
  const weaknesses: string[] = evaluation.weaknesses ?? [];
  const prioritySuggestions: string[] = evaluation.prioritySuggestions ?? evaluation.priority_suggestions ?? [];
  const rawText: string | undefined = evaluation.rawText ?? evaluation.raw_text;

  // 如果只有原始文本（JSON 解析失败），直接显示 markdown
  if (rawText && scores.length === 0) {
    return (
      <Card
        title="评分结果"
        style={{ background: 'linear-gradient(135deg, #f6f8ff 0%, #f0f5ff 100%)', border: '1px solid #d6e4ff' }}
      >
        <div className="markdown-body">
          <ReactMarkdown>{rawText}</ReactMarkdown>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="评分结果"
      style={{ background: 'linear-gradient(135deg, #f6f8ff 0%, #f0f5ff 100%)', border: '1px solid #d6e4ff' }}
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* 总分和等级 */}
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: getGradeColor(grade), lineHeight: 1 }}>
            {totalScore.toFixed(1)}
          </div>
          <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>/ 100</div>
          {grade && (
            <Tag
              color={getGradeColor(grade)}
              style={{ fontSize: 16, padding: '4px 16px', marginTop: 8 }}
            >
              {grade}
            </Tag>
          )}
        </div>

        {/* 各维度得分 */}
        {scores.length > 0 && (
          <div>
            <Text strong style={{ fontSize: 15 }}>各维度得分</Text>
            <div style={{ marginTop: 12 }}>
              {scores.map((item: any, index: number) => {
                const dim = item.dimension ?? '';
                const max = item.maxScore ?? item.max_score ?? 100;
                const sc = item.score ?? 0;
                const pct = max > 0 ? Math.round((sc / max) * 100) : 0;
                const evidence = item.evidence ?? '';
                const suggestion = item.suggestion ?? '';

                return (
                  <div key={index} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>{dim}</Text>
                      <Text strong>{sc} / {max}</Text>
                    </div>
                    <Progress
                      percent={pct}
                      strokeColor={pct >= 80 ? '#52c41a' : pct >= 60 ? '#1890ff' : pct >= 40 ? '#faad14' : '#ff4d4f'}
                      size="small"
                    />
                    {evidence && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        📋 {evidence}
                      </div>
                    )}
                    {suggestion && (
                      <div style={{ fontSize: 12, color: '#1890ff', marginTop: 2 }}>
                        💡 {suggestion}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 优点和不足 */}
        <Row gutter={16}>
          {strengths.length > 0 && (
            <Col span={12}>
              <Card size="small" title="✅ 优点" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                <List
                  size="small"
                  dataSource={strengths}
                  renderItem={(item: string, index: number) => (
                    <List.Item key={index} style={{ padding: '4px 0', border: 'none' }}>
                      <Text>{item}</Text>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          )}
          {weaknesses.length > 0 && (
            <Col span={12}>
              <Card size="small" title="⚠️ 不足" style={{ background: '#fff2e8', border: '1px solid #ffbb96' }}>
                <List
                  size="small"
                  dataSource={weaknesses}
                  renderItem={(item: string, index: number) => (
                    <List.Item key={index} style={{ padding: '4px 0', border: 'none' }}>
                      <Text>{item}</Text>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          )}
        </Row>

        {/* 优先改进建议 */}
        {prioritySuggestions.length > 0 && (
          <div>
            <Text strong style={{ fontSize: 15 }}>🎯 优先改进建议</Text>
            <List
              size="small"
              style={{ marginTop: 8 }}
              dataSource={prioritySuggestions}
              renderItem={(item: string, index: number) => (
                <List.Item key={index}>
                  <Text>
                    <Tag color={index === 0 ? 'red' : index === 1 ? 'orange' : 'blue'}>
                      {index === 0 ? '最紧迫' : index === 1 ? '次重要' : '锦上添花'}
                    </Tag>
                    {item}
                  </Text>
                </List.Item>
              )}
            />
          </div>
        )}
      </Space>
    </Card>
  );
}

// 内容分析视图组件
function ContentAnalysisView({ analysis }: { analysis: any }) {
  // 兼容 snake_case 和 camelCase
  const overallTopic = analysis.overallTopic ?? analysis.overall_topic ?? '未知';
  const summary = analysis.summary ?? '';
  const keyPoints: string[] = analysis.keyPoints ?? analysis.key_points ?? [];
  const keywords: string[] = analysis.keywords ?? [];
  const scenes: any[] = analysis.scenes ?? [];
  const evaluation = analysis.evaluation ?? null;

  const [expandedPoints, setExpandedPoints] = useState(false);
  const displayPoints = expandedPoints ? keyPoints : keyPoints.slice(0, 5);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* 评分结果 */}
      {evaluation && <EvaluationView evaluation={evaluation} />}

      <Card title="内容分析">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 主题 */}
        <div>
          <Text strong>视频主题：</Text>
          <Tag color="blue">{overallTopic}</Tag>
        </div>

        {/* 摘要 - Markdown 渲染，全部显示 */}
        <div>
          <Text strong>内容摘要：</Text>
          <div style={{ marginTop: 8, padding: '12px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
            <div className="markdown-body">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* 关键点 - 默认显示 5 条，可展开 */}
        {keyPoints.length > 0 && (
          <div>
            <Text strong>关键要点：</Text>
            <List
              size="small"
              dataSource={displayPoints}
              renderItem={(point: string, index: number) => (
                <List.Item key={index}>
                  <Text>{index + 1}. {point}</Text>
                </List.Item>
              )}
            />
            {keyPoints.length > 5 && (
              <Button
                type="link"
                size="small"
                onClick={() => setExpandedPoints(!expandedPoints)}
                style={{ padding: 0, marginTop: 4 }}
              >
                {expandedPoints ? '收起' : `展开全部 ${keyPoints.length} 条`}
              </Button>
            )}
          </div>
        )}

        {/* 关键词 */}
        {keywords.length > 0 && (
          <div>
            <Text strong>关键词：</Text>
            <div style={{ marginTop: 8 }}>
              {keywords.map((keyword: string) => (
                <Tag key={keyword} style={{ marginBottom: 4 }}>
                  {keyword}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* 场景 - 分页显示 */}
        {scenes.length > 0 && (
          <div>
            <Text strong>场景分析：</Text>
            <Table
              dataSource={scenes}
              rowKey={(record: any) => `${record.startTime ?? record.start_time}-${record.endTime ?? record.end_time}`}
              size="small"
              pagination={{ pageSize: 5, size: 'small' }}
              columns={[
                {
                  key: 'time',
                  title: '时间',
                  width: 150,
                  render: (_: any, record: any) => (
                    <Text type="secondary">
                      {(record.startTime ?? record.start_time ?? 0).toFixed(1)}s - {(record.endTime ?? record.end_time ?? 0).toFixed(1)}s
                    </Text>
                  ),
                },
                {
                  key: 'description',
                  title: '描述',
                  dataIndex: 'description',
                },
                {
                  key: 'sceneType',
                  title: '类型',
                  dataIndex: 'sceneType',
                  width: 120,
                  render: (type: string, record: any) => {
                    const sceneType = type ?? record.scene_type;
                    return sceneType ? <Tag>{sceneType}</Tag> : '-';
                  },
                },
              ]}
            />
          </div>
        )}
      </Space>
    </Card>
    </Space>
  );
}
