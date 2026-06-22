import {
  CheckCircleOutlined,
  EyeOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Assignment, AssignmentVersion, Student } from '../assignment-management/api';
import type { RubricTemplate } from '../system-admin/api';
import {
  createEvaluationTask,
  fetchEvaluationData,
  getApiErrorMessage,
  resolveAssignmentVersions,
  reviewEvaluationTask,
  type EvaluationTask
} from './api';

const { Paragraph, Text, Title } = Typography;

type EvaluationTaskFormValues = {
  assignmentId: string;
  studentId: string;
  sourceVersionId?: string;
  rubricTemplateId: string;
  operator: string;
};

type ReviewFormValues = {
  reviewerId: string;
  reviewerName?: string;
  revisedScore: number;
  reason: string;
};

const statusConfig: Record<string, { color: string; label: string }> = {
  PENDING_CONFIGURATION: { color: 'warning', label: '待接入模型' },
  AUTO_SCORED: { color: 'processing', label: '已自动评分' },
  REVIEWED: { color: 'green', label: '已人工复核' }
};

export function IntelligentEvaluation() {
  const [apiMessage, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<EvaluationTask[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<RubricTemplate[]>([]);
  const [selectedTask, setSelectedTask] = useState<EvaluationTask | undefined>();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [taskForm] = Form.useForm<EvaluationTaskFormValues>();
  const [reviewForm] = Form.useForm<ReviewFormValues>();
  const selectedAssignmentId = Form.useWatch('assignmentId', taskForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEvaluationData();
      setTasks(data.snapshot.tasks);
      setAssignments(data.assignments);
      setStudents(data.students);
      setTemplates(data.templates);
      setSelectedTask((current) => data.snapshot.tasks.find((task) => task.id === current?.id) ?? data.snapshot.tasks[0]);
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [apiMessage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const versionOptions = useMemo(
    () =>
      resolveAssignmentVersions(assignments, selectedAssignmentId).map((version: AssignmentVersion) => ({
        label: `v${version.version} - ${version.studentName} - ${version.fileName}`,
        value: version.id
      })),
    [assignments, selectedAssignmentId]
  );

  function openTaskModal() {
    taskForm.setFieldsValue({
      assignmentId: assignments[0]?.id,
      studentId: students[0]?.id,
      sourceVersionId: assignments[0]?.versions?.[0]?.id,
      rubricTemplateId: templates[0]?.id,
      operator: 'teacher01'
    });
    setTaskModalOpen(true);
  }

  async function submitTask() {
    try {
      const values = await taskForm.validateFields();
      await createEvaluationTask(values);
      setTaskModalOpen(false);
      await loadData();
      apiMessage.success('已创建智能评价任务');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  function openReviewModal(task: EvaluationTask) {
    setSelectedTask(task);
    reviewForm.setFieldsValue({
      reviewerId: 'teacher01',
      reviewerName: '示例教师',
      revisedScore: task.finalScore ?? task.autoScore,
      reason: ''
    });
    setReviewModalOpen(true);
  }

  async function submitReview() {
    if (!selectedTask) {
      return;
    }
    try {
      const values = await reviewForm.validateFields();
      await reviewEvaluationTask(selectedTask.id, values);
      setReviewModalOpen(false);
      await loadData();
      apiMessage.success('已记录人工复核结果');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  const columns = [
    {
      title: '作业与学生',
      render: (_: unknown, task: EvaluationTask) => (
        <Space direction="vertical" size={2}>
          <Text strong>{task.assignmentTitle}</Text>
          <Text type="secondary">
            {task.studentName} / {task.className} / v{task.sourceVersionNumber}
          </Text>
        </Space>
      )
    },
    {
      title: '评价模板',
      render: (_: unknown, task: EvaluationTask) => (
        <Space direction="vertical" size={2}>
          <Text>{task.rubricTemplateName}</Text>
          <Text type="secondary">v{task.rubricVersion}</Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => {
        const config = statusConfig[status] ?? { color: 'default', label: status };
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: '自动分',
      dataIndex: 'autoScore',
      width: 90
    },
    {
      title: '最终分',
      render: (_: unknown, task: EvaluationTask) => task.finalScore ?? '-',
      width: 90
    },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, task: EvaluationTask) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => setSelectedTask(task)}>
            查看
          </Button>
          <Button icon={<CheckCircleOutlined />} onClick={() => openReviewModal(task)}>
            复核
          </Button>
        </Space>
      )
    }
  ];

  return (
    <section>
      {contextHolder}
      <Space direction="vertical" size={20} className="content-stack">
        <Space align="start" className="toolbar-row">
          <div>
            <Title level={2}>智能评价</Title>
            <Paragraph type="secondary">
              统一管理自动评分任务、评分依据、问题定位、修改建议和人工复核记录。当前版本先打通前后端链路，真实模型评分后续接入。
            </Paragraph>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openTaskModal}>
              新建评价任务
            </Button>
          </Space>
        </Space>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="评价任务数" value={tasks.length} prefix={<FileSearchOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="待接入模型"
                value={tasks.filter((task) => task.status === 'PENDING_CONFIGURATION').length}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="已人工复核" value={tasks.filter((task) => task.status === 'REVIEWED').length} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <Card title="评价任务列表">
              <Table
                rowKey="id"
                loading={loading}
                columns={columns}
                dataSource={tasks}
                pagination={{ pageSize: 6 }}
              />
            </Card>
          </Col>
          <Col xs={24} xl={10}>
            <Card title="任务详情">
              {selectedTask ? (
                <Space direction="vertical" size={16} className="content-stack">
                  <Descriptions size="small" column={1} bordered>
                    <Descriptions.Item label="任务状态">
                      <Tag color={(statusConfig[selectedTask.status] ?? { color: 'default' }).color}>
                        {(statusConfig[selectedTask.status] ?? { label: selectedTask.status }).label}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="作业">{selectedTask.assignmentTitle}</Descriptions.Item>
                    <Descriptions.Item label="学生">{selectedTask.studentName}</Descriptions.Item>
                    <Descriptions.Item label="评价模板">
                      {selectedTask.rubricTemplateName} / v{selectedTask.rubricVersion}
                    </Descriptions.Item>
                    <Descriptions.Item label="自动分">{selectedTask.autoScore}</Descriptions.Item>
                    <Descriptions.Item label="最终分">{selectedTask.finalScore ?? '-'}</Descriptions.Item>
                  </Descriptions>

                  <div>
                    <Text strong>评分说明</Text>
                    <Paragraph className="detail-paragraph">{selectedTask.summary}</Paragraph>
                  </div>

                  <div>
                    <Text strong>维度得分</Text>
                    <Table
                      rowKey="dimensionName"
                      size="small"
                      pagination={false}
                      dataSource={selectedTask.dimensionScores}
                      columns={[
                        { title: '维度', dataIndex: 'dimensionName' },
                        { title: '得分', render: (_: unknown, row: { score: number; maxScore: number }) => `${row.score}/${row.maxScore}` },
                        { title: '权重', dataIndex: 'weight', render: (value: number) => `${value}%` }
                      ]}
                    />
                  </div>

                  <div>
                    <Text strong>问题识别</Text>
                    <Space direction="vertical" size={8} className="content-stack">
                      {selectedTask.issues.map((issue) => (
                        <Card key={issue.id} size="small" className="embedded-card">
                          <Space direction="vertical" size={4}>
                            <Text strong>{issue.title}</Text>
                            <Text type="secondary">
                              {issue.category} / {issue.severity} / {issue.locationHint || '未定位'}
                            </Text>
                            <Text>{issue.description}</Text>
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  </div>

                  <div>
                    <Text strong>修改建议</Text>
                    <ul className="bullet-list">
                      {selectedTask.suggestions.map((suggestion) => (
                        <li key={suggestion.id}>
                          <Text strong>{suggestion.title}</Text>
                          <div>{suggestion.details}</div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <Text strong>人工复核记录</Text>
                    {selectedTask.reviewRecords.length === 0 ? (
                      <Paragraph type="secondary" className="detail-paragraph">
                        暂无人工复核记录。
                      </Paragraph>
                    ) : (
                      <Space direction="vertical" size={8} className="content-stack">
                        {selectedTask.reviewRecords.map((record) => (
                          <Card key={record.id} size="small" className="embedded-card">
                            <Space direction="vertical" size={4}>
                              <Text strong>
                                {record.reviewerName || record.reviewerId}
                                {'，'}
                                {record.originalScore}
                                {' -> '}
                                {record.revisedScore}
                              </Text>
                              <Text type="secondary">{record.reviewedAt}</Text>
                              <Text>{record.reason}</Text>
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    )}
                  </div>
                </Space>
              ) : (
                <Text type="secondary">请选择一条评价任务查看详情。</Text>
              )}
            </Card>
          </Col>
        </Row>
      </Space>

      <Modal
        title="新建智能评价任务"
        open={taskModalOpen}
        onCancel={() => setTaskModalOpen(false)}
        onOk={() => void submitTask()}
        width={720}
      >
        <Form form={taskForm} layout="vertical">
          <Form.Item name="assignmentId" label="作业" rules={[{ required: true }]}>
            <Select
              options={assignments.map((assignment) => ({
                label: assignment.title,
                value: assignment.id
              }))}
            />
          </Form.Item>
          <Form.Item name="studentId" label="学生" rules={[{ required: true }]}>
            <Select
              options={students.map((student) => ({
                label: `${student.studentNo} ${student.name}`,
                value: student.id
              }))}
            />
          </Form.Item>
          <Form.Item name="sourceVersionId" label="作业版本">
            <Select allowClear options={versionOptions} />
          </Form.Item>
          <Form.Item name="rubricTemplateId" label="评价模板" rules={[{ required: true }]}>
            <Select
              options={templates.map((template) => ({
                label: `${template.name} / v${template.currentVersion}`,
                value: template.id
              }))}
            />
          </Form.Item>
          <Form.Item name="operator" label="发起人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="人工复核评分"
        open={reviewModalOpen}
        onCancel={() => setReviewModalOpen(false)}
        onOk={() => void submitReview()}
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="reviewerId" label="复核人 ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="reviewerName" label="复核人姓名">
            <Input />
          </Form.Item>
          <Form.Item name="revisedScore" label="修正后分数" rules={[{ required: true }]}>
            <InputNumber className="full-width" min={0} max={100} />
          </Form.Item>
          <Form.Item name="reason" label="修正原因" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
