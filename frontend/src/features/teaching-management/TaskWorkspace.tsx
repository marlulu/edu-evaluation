import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  RobotOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createReviewDrafts,
  deleteTaskAttachment,
  fetchTaskAttachments,
  fetchTaskDetail,
  fetchTaskSubmissions,
  importSubmissionRule,
  saveReview,
  saveSubmissionRule,
  updateTask,
  uploadTaskAttachment,
  type SubmissionRule,
  type TaskAttachment,
  type TaskDetail,
  type TaskSubmission
} from './taskWorkspaceApi';

const { Text, Title } = Typography;
const extensionOptions = ['.pdf', '.docx', '.txt', '.md', '.zip', '.pptx', '.xlsx', '.jpg', '.png', '.mp3', '.mp4'];

type RuleForm = {
  allowedExtensions: string[];
  maxFileSizeMb: number;
  ruleText: string;
};

type ReviewForm = {
  score: number | null;
  feedback: string;
};

type ContentForm = {
  description: string;
};

type TaskWorkspaceProps = {
  taskId: string;
  onBack: () => void;
};

function readableError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error) && typeof error.response?.data === 'object' && error.response.data !== null
    && 'message' in error.response.data && typeof error.response.data.message === 'string') {
    return error.response.data.message;
  }
  return fallback;
}

function toRuleForm(rule: SubmissionRule): RuleForm {
  return {
    allowedExtensions: rule.allowedExtensions,
    maxFileSizeMb: Math.max(1, Math.round(rule.maxFileSizeBytes / 1024 / 1024)),
    ruleText: rule.ruleText ?? ''
  };
}

export function TaskWorkspace({ taskId, onBack }: TaskWorkspaceProps) {
  const [detail, setDetail] = useState<TaskDetail>();
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingSubmission, setEditingSubmission] = useState<TaskSubmission>();
  const [ruleForm] = Form.useForm<RuleForm>();
  const [contentForm] = Form.useForm<ContentForm>();
  const [reviewForm] = Form.useForm<ReviewForm>();
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDetail, nextSubmissions, nextAttachments] = await Promise.all([
        fetchTaskDetail(taskId),
        fetchTaskSubmissions(taskId),
        fetchTaskAttachments(taskId)
      ]);
      setDetail(nextDetail);
      setSubmissions(nextSubmissions);
      setAttachments(nextAttachments);
      ruleForm.setFieldsValue(toRuleForm(nextDetail.rule));
      contentForm.setFieldsValue({ description: nextDetail.description });
    } catch (error) {
      messageApi.error(readableError(error, '作业详情加载失败'));
    } finally {
      setLoading(false);
    }
  }, [contentForm, messageApi, ruleForm, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRule() {
    if (!detail) return;
    const values = await ruleForm.validateFields();
    setSavingRule(true);
    try {
      const rule = await saveSubmissionRule(taskId, {
        allowedExtensions: values.allowedExtensions ?? [],
        maxFileSizeBytes: Math.round(values.maxFileSizeMb * 1024 * 1024),
        ruleText: values.ruleText.trim() || null,
        importedFileName: detail.rule.importedFileName
      });
      setDetail({ ...detail, rule });
      ruleForm.setFieldsValue(toRuleForm(rule));
      messageApi.success('提交规则已保存');
    } catch (error) {
      messageApi.error(readableError(error, '提交规则保存失败'));
    } finally {
      setSavingRule(false);
    }
  }

  async function saveContent() {
    if (!detail) return;
    const values = await contentForm.validateFields();
    setSavingContent(true);
    try {
      const updated = await updateTask(taskId, { ...detail, description: values.description });
      setDetail({ ...detail, ...updated });
      messageApi.success('作业说明已保存');
    } catch (error) {
      messageApi.error(readableError(error, '作业说明保存失败'));
    } finally {
      setSavingContent(false);
    }
  }

  async function addAttachment(file: File) {
    try {
      await uploadTaskAttachment(taskId, file);
      await load();
      messageApi.success('作业附件已上传');
    } catch (error) {
      messageApi.error(readableError(error, '作业附件上传失败'));
    }
    return false;
  }

  async function removeAttachment(attachment: TaskAttachment) {
    try {
      await deleteTaskAttachment(attachment.deleteUrl);
      await load();
      messageApi.success('作业附件已删除');
    } catch (error) {
      messageApi.error(readableError(error, '作业附件删除失败'));
    }
  }

  async function importRule(file: File) {
    try {
      const result = await importSubmissionRule(taskId, file);
      ruleForm.setFieldsValue({
        ruleText: result.ruleText,
        allowedExtensions: result.allowedExtensions.length ? result.allowedExtensions : ruleForm.getFieldValue('allowedExtensions'),
        maxFileSizeMb: result.maxFileSizeBytes ? Math.ceil(result.maxFileSizeBytes / 1024 / 1024) : ruleForm.getFieldValue('maxFileSizeMb')
      });
      if (detail) {
        setDetail({ ...detail, rule: { ...detail.rule, importedFileName: result.fileName } });
      }
      messageApi.success('规则文档已解析，请检查后保存');
    } catch (error) {
      messageApi.error(readableError(error, '规则文档解析失败'));
    }
    return false;
  }

  async function createDrafts(ids: string[]) {
    if (!ids.length) {
      messageApi.warning('请选择需要批阅的提交作品');
      return;
    }
    setReviewing(true);
    try {
      await createReviewDrafts(taskId, ids);
      messageApi.success(ids.length === 1 ? '已发起智能批阅' : `已发起 ${ids.length} 份智能批阅`);
      await load();
    } catch (error) {
      messageApi.error(readableError(error, '智能批阅发起失败'));
    } finally {
      setReviewing(false);
    }
  }

  function openReview(submission: TaskSubmission) {
    setEditingSubmission(submission);
    reviewForm.setFieldsValue({ score: submission.review?.score ?? null, feedback: submission.review?.feedback ?? '' });
  }

  async function persistReview(publish: boolean) {
    if (!editingSubmission) return;
    const values = await reviewForm.validateFields();
    try {
      await saveReview(taskId, editingSubmission.id, { ...values, publish });
      messageApi.success(publish ? '批阅结果已发布' : '批阅草稿已保存');
      setEditingSubmission(undefined);
      await load();
    } catch (error) {
      messageApi.error(readableError(error, '批阅保存失败'));
    }
  }

  const reviewColumns: ColumnsType<TaskSubmission> = [
    { title: '学生', dataIndex: 'studentId', width: 150, ellipsis: true },
    { title: '提交文件', dataIndex: 'fileName', ellipsis: true },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString()
    },
    {
      title: '状态',
      width: 120,
      render: (_, submission) => submission.review
        ? <Tag color={submission.review.status === 'PUBLISHED' ? 'green' : 'gold'}>{submission.review.status === 'PUBLISHED' ? '已发布' : '草稿'}</Tag>
        : <Tag>待批阅</Tag>
    },
    {
      title: '操作',
      width: 170,
      render: (_, submission) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => void createDrafts([submission.id])}>智能批阅</Button>
          <Button type="link" size="small" disabled={!submission.review} onClick={() => openReview(submission)}>编辑草稿</Button>
        </Space>
      )
    }
  ];

  const analysis = useMemo(() => {
    const reviewed = submissions.filter((item) => item.review);
    const published = reviewed.filter((item) => item.review?.status === 'PUBLISHED');
    const scores = published.map((item) => item.review?.score).filter((score): score is number => score !== null && score !== undefined);
    return {
      submitted: submissions.length,
      reviewing: reviewed.length,
      published: published.length,
      average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
    };
  }, [submissions]);

  return (
    <div className="task-workspace">
      {contextHolder}
      <section className="task-workspace-header">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>返回作业列表</Button>
        <div>
          <Title level={2}>{detail?.title ?? '作业详情'}</Title>
          <Text type="secondary">作业提交、批阅与分析</Text>
        </div>
      </section>
      <Tabs
        className="task-workspace-tabs"
        items={[
          {
            key: 'detail',
            label: '作业详情',
            children: (
              <div className="task-workspace-content">
                <Card loading={loading} className="task-detail-card">
                  {detail && <>
                    <Descriptions column={{ xs: 1, md: 2 }} size="small">
                      <Descriptions.Item label="作业状态"><Tag color={detail.status === 'ACTIVE' ? 'green' : 'default'}>{detail.status}</Tag></Descriptions.Item>
                      <Descriptions.Item label="截止时间">{detail.deadline ? new Date(detail.deadline).toLocaleString() : '未设置'}</Descriptions.Item>
                      <Descriptions.Item label="已提交作品">{detail.submissionCount} 份</Descriptions.Item>
                    </Descriptions>
                    <Form form={contentForm} layout="vertical" className="task-content-form">
                      <Form.Item name="description" label="作业说明">
                        <Input.TextArea rows={6} placeholder="填写作业说明、要求和补充信息。" />
                      </Form.Item>
                      <Button type="primary" loading={savingContent} onClick={() => void saveContent()}>保存作业说明</Button>
                    </Form>
                    <section className="task-attachment-section">
                      <div className="task-attachment-heading">
                        <Title level={5}>作业附件</Title>
                        <Upload multiple showUploadList={false} beforeUpload={addAttachment}>
                          <Button icon={<UploadOutlined />}>上传附件</Button>
                        </Upload>
                      </div>
                      {attachments.length ? attachments.map((attachment) => (
                        <div className="task-attachment-row" key={attachment.downloadUrl}>
                          <Button type="link" icon={<DownloadOutlined />} href={attachment.downloadUrl}>{attachment.fileName}</Button>
                          <Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除 ${attachment.fileName}`} onClick={() => void removeAttachment(attachment)} />
                        </div>
                      )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无作业附件" />}
                    </section>
                  </>}
                </Card>
                <Card title="学生提交规则" className="task-rule-card">
                  <Alert type="info" showIcon message="规则将在学生选择文件时提示，并由服务端在保存前强制校验。" />
                  <Form form={ruleForm} layout="vertical" className="task-rule-form">
                    <Form.Item name="allowedExtensions" label="允许文件类型">
                      <Checkbox.Group options={extensionOptions} />
                    </Form.Item>
                    <Form.Item name="maxFileSizeMb" label="单文件最大大小（MB）" rules={[{ required: true, message: '请输入文件大小' }]}>
                      <InputNumber min={1} max={100} precision={0} />
                    </Form.Item>
                    <Form.Item name="ruleText" label="文字规则">
                      <Input.TextArea rows={6} placeholder="填写提交格式、命名方式、内容要求等。" />
                    </Form.Item>
                    <Space wrap>
                      <Upload accept=".pdf,.docx,.txt,.md" showUploadList={false} beforeUpload={importRule}>
                        <Button icon={<UploadOutlined />}>导入规则文档</Button>
                      </Upload>
                      <Button type="primary" icon={<SaveOutlined />} loading={savingRule} onClick={() => void saveRule()}>保存规则</Button>
                    </Space>
                    {detail?.rule.importedFileName && <Text type="secondary">最近导入：{detail.rule.importedFileName}</Text>}
                  </Form>
                </Card>
              </div>
            )
          },
          {
            key: 'review',
            label: '作业批阅',
            children: (
              <div className="task-workspace-content">
                <Card className="task-review-card" loading={loading}>
                  <div className="task-review-toolbar">
                    <div><Title level={4}>提交作品</Title><Text type="secondary">智能批阅只生成草稿，教师确认后才会发布。</Text></div>
                    <Button type="primary" icon={<RobotOutlined />} loading={reviewing} disabled={!selectedIds.length} onClick={() => void createDrafts(selectedIds)}>
                      批量智能批阅
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys.map(String)) }}
                    columns={reviewColumns}
                    dataSource={submissions}
                    pagination={{ pageSize: 8 }}
                    locale={{ emptyText: <Empty description="暂无学生提交作品" /> }}
                  />
                </Card>
              </div>
            )
          },
          {
            key: 'analysis',
            label: '作业分析',
            children: (
              <div className="task-workspace-content">
                <section className="task-analysis-grid">
                  <Card><Statistic title="已提交" value={analysis.submitted} suffix="份" /></Card>
                  <Card><Statistic title="已生成草稿" value={analysis.reviewing} suffix="份" /></Card>
                  <Card><Statistic title="已发布结果" value={analysis.published} suffix="份" /></Card>
                  <Card><Statistic title="已发布平均分" value={analysis.average} precision={1} /></Card>
                </section>
                <Card title="批阅完成度">
                  <Progress percent={analysis.submitted ? Math.round(analysis.reviewing / analysis.submitted * 100) : 0} />
                  {!analysis.submitted && <Empty description="学生提交后将在这里汇总作业分析" />}
                </Card>
              </div>
            )
          }
        ]}
      />
      <Modal
        title="编辑批阅草稿"
        open={Boolean(editingSubmission)}
        onCancel={() => setEditingSubmission(undefined)}
        footer={[
          <Button key="cancel" onClick={() => setEditingSubmission(undefined)}>取消</Button>,
          <Button key="draft" onClick={() => void persistReview(false)}>保存草稿</Button>,
          <Button key="publish" type="primary" onClick={() => void persistReview(true)}>确认发布</Button>
        ]}
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="score" label="分数"><InputNumber min={0} max={100} className="full-width" /></Form.Item>
          <Form.Item name="feedback" label="评语"><Input.TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
