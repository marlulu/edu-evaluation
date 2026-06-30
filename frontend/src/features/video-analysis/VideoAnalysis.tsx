import ReactMarkdown from 'react-markdown';
import {
  AudioOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  VideoCameraOutlined,
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
  Radio,
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
  type VideoAnalysisResult,
  type VideoTaskStatus,
  analyzeVideoAsync,
  deleteVideoTask,
  getVideoCapabilities,
  getVideoTaskStatus,
  listVideoTasks,
  uploadVideo
} from './api';

const { Paragraph, Text, Title } = Typography;

const statusLabels: Record<VideoTaskStatus, string> = {
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

const statusColors: Record<VideoTaskStatus, string> = {
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

const stageOrder: VideoTaskStatus[] = [
  'pending',
  'preprocessing',
  'extracting_metadata',
  'extracting_keyframes',
  'extracting_audio',
  'transcribing',
  'analyzing_content',
  'completed',
];

export function VideoAnalysis() {
  const [apiMessage, contextHolder] = message.useMessage();
  const [tasks, setTasks] = useState<VideoAnalysisResult[]>([]);
  const [selectedTask, setSelectedTask] = useState<VideoAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | undefined>();
  const [form] = Form.useForm();

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listVideoTasks();
      const taskList = result.tasks as VideoAnalysisResult[];
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
      const caps = await getVideoCapabilities();
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
        const detail = await getVideoTaskStatus(selectedTask.taskId);
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

  const handleSelectTask = (task: VideoAnalysisResult) => {
    setSelectedTask(task);
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteVideoTask(taskId);
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

      // 1. 上传文件
      const uploadResult = await uploadVideo(uploadFile);
      if (!uploadResult.success || !uploadResult.filePath) {
        apiMessage.error(uploadResult.message || '文件上传失败');
        return;
      }

      // 2. 提交分析任务
      const result = await analyzeVideoAsync({
        fileName: uploadResult.fileName || uploadFile.name,
        filePath: uploadResult.filePath,
        videoType: values.videoType,
        criteriaText: values.criteriaText || undefined,
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
      form.resetFields();

      // 立即将新任务插入列表并选中
      const newTask = {
        taskId: result.taskId,
        fileName: uploadResult.fileName || uploadFile.name,
        status: 'pending' as VideoTaskStatus,
        progress: 0,
      } as VideoAnalysisResult;
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
            <VideoCameraOutlined /> 视频分析
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
          form.resetFields();
        }}
        confirmLoading={uploading}
        okText="提交分析"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" initialValues={{ videoType: 'work', maxKeyframes: 15 }}>
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

          <Form.Item name="videoType" label="分析类型" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="work">作品讲解</Radio.Button>
              <Radio.Button value="defense">答辩</Radio.Button>
            </Radio.Group>
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

          <Form.Item name="criteriaText" label="评判标准（可选，留空使用内置默认标准）">
            <Input.TextArea
              rows={4}
              placeholder="粘贴评判标准文本，或留空使用系统内置的默认评判标准..."
            />
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
  task: VideoAnalysisResult;
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
              {formatDuration(task.metadata.durationSeconds ?? task.metadata.duration_seconds ?? 0)}
            </Descriptions.Item>
            <Descriptions.Item label="分辨率">
              {task.metadata.width} × {task.metadata.height}
            </Descriptions.Item>
            <Descriptions.Item label="帧率">
              {(task.metadata.fps ?? 0).toFixed(1)} fps
            </Descriptions.Item>
            <Descriptions.Item label="编码">{task.metadata.codec}</Descriptions.Item>
            <Descriptions.Item label="文件大小">
              {formatFileSize(task.metadata.fileSize ?? task.metadata.file_size ?? 0)}
            </Descriptions.Item>
            <Descriptions.Item label="音频">
              {(task.metadata.hasAudio ?? task.metadata.has_audio) ? (
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
              <Tag>{task.technicalQuality.videoQuality ?? task.technicalQuality.video_quality}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="音频质量">
              <Tag>{task.technicalQuality.audioQuality ?? task.technicalQuality.audio_quality}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="稳定性">
              <Tag>{task.technicalQuality.stability}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="综合评分">
              <Progress
                percent={task.technicalQuality.overallScore ?? task.technicalQuality.overall_score}
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
      {task.audioAnalysis && (task.audioAnalysis.transcription ?? task.audioAnalysis.transcription)?.length > 0 && (
        <Card
          title={
            <Space>
              <AudioOutlined />
              <span>语音转录</span>
              <Tag>{(task.audioAnalysis.detectedLanguage ?? task.audioAnalysis.detected_language) === 'zh' ? '中文' : '英文'}</Tag>
            </Space>
          }
          extra={
            <Space>
              <Text type="secondary">
                语速：{(task.audioAnalysis.averageSpeechRate ?? task.audioAnalysis.average_speech_rate ?? 0).toFixed(0)} 字/分钟
              </Text>
              {(task.audioAnalysis.clarityScore ?? task.audioAnalysis.clarity_score) && (
                <Text type="secondary">
                  清晰度：{((task.audioAnalysis.clarityScore ?? task.audioAnalysis.clarity_score) * 100).toFixed(0)}%
                </Text>
              )}
            </Space>
          }
        >
          <Table
            dataSource={task.audioAnalysis.transcription ?? task.audioAnalysis.transcription}
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

// 内容分析视图组件
function ContentAnalysisView({ analysis }: { analysis: any }) {
  // 兼容 snake_case 和 camelCase
  const overallTopic = analysis.overallTopic ?? analysis.overall_topic ?? '未知';
  const summary = analysis.summary ?? '';
  const keyPoints: string[] = analysis.keyPoints ?? analysis.key_points ?? [];
  const keywords: string[] = analysis.keywords ?? [];
  const scenes: any[] = analysis.scenes ?? [];

  const [expandedSummary, setExpandedSummary] = useState(false);
  const [expandedPoints, setExpandedPoints] = useState(false);
  const displayPoints = expandedPoints ? keyPoints : keyPoints.slice(0, 5);

  // 摘要预览（前 300 字符）
  const summaryPreview = summary.length > 300 ? summary.slice(0, 300) + '...' : summary;
  const needExpand = summary.length > 300;

  return (
    <Card title="内容分析">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 主题 */}
        <div>
          <Text strong>视频主题：</Text>
          <Tag color="blue">{overallTopic}</Tag>
        </div>

        {/* 摘要 - Markdown 渲染，可折叠 */}
        <div>
          <Text strong>内容摘要：</Text>
          <div style={{ marginTop: 8, padding: '12px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
            <div className="markdown-body" style={{ maxHeight: expandedSummary ? 'none' : 200, overflow: 'hidden', transition: 'max-height 0.3s' }}>
              <ReactMarkdown>{expandedSummary ? summary : summaryPreview}</ReactMarkdown>
            </div>
            {needExpand && (
              <Button
                type="link"
                size="small"
                onClick={() => setExpandedSummary(!expandedSummary)}
                style={{ padding: '4px 0', marginTop: 8 }}
              >
                {expandedSummary ? '收起' : '展开全文'}
              </Button>
            )}
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
  );
}
