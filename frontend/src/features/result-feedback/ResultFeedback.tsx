import { BarChartOutlined, DownloadOutlined, FilePdfOutlined, MessageOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Space, Table, Tabs, Tag, Typography, Upload, message } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { useCallback, useEffect, useState } from 'react';
import type { Assignment, Student } from '../assignment-management/api';
import {
  type ComparisonRow,
  type ResultReport,
  appendReportFeedback,
  exportResultExcel,
  exportResultPdf,
  fetchAssignmentComparison,
  fetchResultData,
  fetchStudentHistory,
  getApiErrorMessage,
  resubmitReport,
  saveResultReport
} from './api';
import { ComparisonCard, DimensionBarChart, RadarChart } from './Charts';

const { Paragraph, Text, Title } = Typography;

type ReportFormValues = {
  assignmentId: string;
  studentId: string;
  evaluator: string;
  teacherSummary: string;
  strengthsText: string;
  weaknessesText: string;
  suggestionsText: string;
  dimensionOneScore: number;
  dimensionOneComment: string;
  dimensionTwoScore: number;
  dimensionTwoComment: string;
  dimensionThreeScore: number;
  dimensionThreeComment: string;
  dimensionFourScore: number;
  dimensionFourComment: string;
};

type FeedbackFormValues = {
  actor: string;
  comment: string;
};

type ResubmitFormValues = {
  note: string;
};

const dimensionNames = ['AI 概念准确性', '算法理解', '案例分析', '结构表达'];

export function ResultFeedback() {
  const [apiMessage, contextHolder] = message.useMessage();
  const [reports, setReports] = useState<ResultReport[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classAverages, setClassAverages] = useState([]);
  const [studentHistory, setStudentHistory] = useState<ComparisonRow[]>([]);
  const [classComparison, setClassComparison] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ResultReport | undefined>();
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitFile, setResubmitFile] = useState<File | undefined>();
  const [reportForm] = Form.useForm<ReportFormValues>();
  const [feedbackForm] = Form.useForm<FeedbackFormValues>();
  const [resubmitForm] = Form.useForm<ResubmitFormValues>();

  const assignmentOptions = assignments.map((assignment) => ({ label: assignment.title, value: assignment.id }));
  const studentOptions = students.map((student) => ({ label: `${student.studentNo} ${student.name}`, value: student.id }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchResultData();
      setReports(data.snapshot.reports);
      setAssignments(data.assignments);
      setStudents(data.students);
      setClassAverages(data.snapshot.classAverages as never[]);
      setStudentHistory(data.snapshot.studentHistory);
      setClassComparison(data.snapshot.classComparison);
      setSelectedReport((current) => data.snapshot.reports.find((report) => report.id === current?.id) ?? data.snapshot.reports[0]);
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [apiMessage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedReport) {
      void fetchStudentHistory(selectedReport.studentId).then(setStudentHistory);
      void fetchAssignmentComparison(selectedReport.assignmentId).then(setClassComparison);
    }
  }, [selectedReport]);

  function openReportModal() {
    reportForm.setFieldsValue({
      assignmentId: assignments[0]?.id,
      studentId: students[0]?.id,
      evaluator: 'teacher01',
      teacherSummary: '',
      strengthsText: '概念理解较好\n结构完整',
      weaknessesText: '算法分析深度不足',
      suggestionsText: '补充复杂度分析\n增加结论与证据对应',
      dimensionOneScore: 22,
      dimensionOneComment: '概念表述准确',
      dimensionTwoScore: 20,
      dimensionTwoComment: '算法说明完整',
      dimensionThreeScore: 16,
      dimensionThreeComment: '案例分析较为充分',
      dimensionFourScore: 24,
      dimensionFourComment: '表达清晰，建议更聚焦'
    });
    setReportModalOpen(true);
  }

  async function submitReport() {
    try {
      const values = await reportForm.validateFields();
      await saveResultReport({
        assignmentId: values.assignmentId,
        studentId: values.studentId,
        evaluator: values.evaluator,
        teacherSummary: values.teacherSummary,
        strengths: splitLines(values.strengthsText),
        weaknesses: splitLines(values.weaknessesText),
        suggestions: splitLines(values.suggestionsText),
        dimensions: [
          { name: dimensionNames[0], score: values.dimensionOneScore, maxScore: 25, comment: values.dimensionOneComment },
          { name: dimensionNames[1], score: values.dimensionTwoScore, maxScore: 25, comment: values.dimensionTwoComment },
          { name: dimensionNames[2], score: values.dimensionThreeScore, maxScore: 20, comment: values.dimensionThreeComment },
          { name: dimensionNames[3], score: values.dimensionFourScore, maxScore: 30, comment: values.dimensionFourComment }
        ]
      });
      setReportModalOpen(false);
      await loadData();
      apiMessage.success('评价结果已生成');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function submitFeedback() {
    if (!selectedReport) {
      return;
    }
    try {
      const values = await feedbackForm.validateFields();
      await appendReportFeedback(selectedReport.id, values.actor, values.comment);
      setFeedbackModalOpen(false);
      feedbackForm.resetFields();
      await loadData();
      apiMessage.success('反馈记录已追加');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function submitResubmission() {
    if (!selectedReport || !resubmitFile) {
      apiMessage.warning('请选择重新提交的文件');
      return;
    }
    try {
      const values = await resubmitForm.validateFields();
      await resubmitReport(selectedReport.id, selectedReport.studentId, values.note, resubmitFile);
      setResubmitModalOpen(false);
      setResubmitFile(undefined);
      resubmitForm.resetFields();
      await loadData();
      apiMessage.success('学生新版本作业已关联到反馈闭环');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  const reportColumns = [
    {
      title: '学生作业',
      render: (_: unknown, report: ResultReport) => (
        <Space direction="vertical" size={2}>
          <Text strong>{report.assignmentTitle}</Text>
          <Text type="secondary">
            {report.studentName} · {report.className} · v{report.sourceVersionNumber}
          </Text>
        </Space>
      )
    },
    { title: '总分', dataIndex: 'overallScore', width: 80 },
    {
      title: '维度分布',
      render: (_: unknown, report: ResultReport) => report.dimensions.map((dimension) => <Tag key={dimension.name}>{dimension.name}: {dimension.score}</Tag>)
    },
    { title: '评价人', dataIndex: 'evaluator', width: 100 },
    { title: '发布时间', dataIndex: 'releasedAt', width: 180 },
    {
      title: '操作',
      width: 260,
      render: (_: unknown, report: ResultReport) => (
        <Space>
          <Button onClick={() => setSelectedReport(report)}>查看</Button>
          <Button
            icon={<MessageOutlined />}
            onClick={() => {
              setSelectedReport(report);
              feedbackForm.setFieldsValue({ actor: 'teacher01', comment: '' });
              setFeedbackModalOpen(true);
            }}
          >
            追加反馈
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={() => void exportResultPdf(report.id)} />
        </Space>
      )
    }
  ];

  return (
    <section>
      {contextHolder}
      <Card>
        <Space direction="vertical" size={20} className="content-stack">
          <Space align="start" className="toolbar-row">
            <div>
              <Title level={2}>结果展示与反馈模块</Title>
              <Paragraph type="secondary">
                支持结果可视化、详细评价报告、历史记录查询、导出，以及“评价-修改-再评价”的闭环反馈记录。
              </Paragraph>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
                刷新
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => void exportResultExcel({})}>
                导出 Excel(CSV)
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openReportModal}>
                发布评价
              </Button>
            </Space>
          </Space>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <DimensionBarChart averages={classAverages as never[]} />
            </Col>
            <Col xs={24} xl={12}>
              {selectedReport ? <RadarChart dimensions={selectedReport.dimensions} /> : <Card title="单份作业雷达图"><Text type="secondary">暂无评价数据</Text></Card>}
            </Col>
            <Col xs={24} lg={12}>
              <ComparisonCard title="学生历史评价记录" rows={studentHistory} />
            </Col>
            <Col xs={24} lg={12}>
              <ComparisonCard title="同批次横向对比" rows={classComparison} />
            </Col>
          </Row>

          <Tabs
            items={[
              {
                key: 'reports',
                label: '评价报告',
                children: <Table rowKey="id" loading={loading} dataSource={reports} columns={reportColumns} />
              },
              {
                key: 'detail',
                label: '报告详情',
                children: selectedReport ? (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} xl={14}>
                      <Card title="详细评价报告">
                        <Space direction="vertical" className="content-stack">
                          <Title level={4} className="compact-title">
                            {selectedReport.assignmentTitle}
                          </Title>
                          <Text type="secondary">
                            {selectedReport.studentName} · {selectedReport.className} · 第 {selectedReport.sourceVersionNumber} 版
                          </Text>
                          <Text strong>总分：{selectedReport.overallScore}</Text>
                          <Paragraph>{selectedReport.teacherSummary}</Paragraph>
                          <Table
                            rowKey="name"
                            size="small"
                            pagination={false}
                            dataSource={selectedReport.dimensions}
                            columns={[
                              { title: '维度', dataIndex: 'name' },
                              { title: '得分', render: (_: unknown, dimension) => `${dimension.score}/${dimension.maxScore}` },
                              { title: '分析', dataIndex: 'comment' }
                            ]}
                          />
                          <Text strong>优势分析</Text>
                          <ul>{selectedReport.strengths.map((value) => <li key={value}>{value}</li>)}</ul>
                          <Text strong>待改进项</Text>
                          <ul>{selectedReport.weaknesses.map((value) => <li key={value}>{value}</li>)}</ul>
                          <Text strong>修改建议</Text>
                          <ul>{selectedReport.suggestions.map((value) => <li key={value}>{value}</li>)}</ul>
                        </Space>
                      </Card>
                    </Col>
                    <Col xs={24} xl={10}>
                      <Card title="反馈闭环">
                        <Space direction="vertical" className="content-stack">
                          {selectedReport.feedbackTrail.map((entry) => (
                            <Card key={entry.id} size="small" className="form-subcard">
                              <Space direction="vertical" size={4}>
                                <Text strong>{entry.actionType}</Text>
                                <Text type="secondary">{entry.actor} · {entry.createdAt}</Text>
                                <Text>{entry.comment}</Text>
                                <Text type="secondary">
                                  {entry.sourceVersionId}
                                  {' -> '}
                                  {entry.targetVersionId}
                                </Text>
                              </Space>
                            </Card>
                          ))}
                          <Space>
                            <Button
                              icon={<MessageOutlined />}
                              onClick={() => {
                                feedbackForm.setFieldsValue({ actor: 'teacher01', comment: '' });
                                setFeedbackModalOpen(true);
                              }}
                            >
                              追加反馈
                            </Button>
                            <Button icon={<UploadOutlined />} onClick={() => setResubmitModalOpen(true)}>
                              学生再次提交
                            </Button>
                          </Space>
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                ) : (
                  <Card><Text type="secondary">请选择一条评价报告查看详情。</Text></Card>
                )
              }
            ]}
          />
        </Space>
      </Card>

      <Modal title="发布评价报告" open={reportModalOpen} onCancel={() => setReportModalOpen(false)} onOk={() => void submitReport()} width={920}>
        <Form form={reportForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assignmentId" label="作业" rules={[{ required: true }]}>
                <Select options={assignmentOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="studentId" label="学生" rules={[{ required: true }]}>
                <Select options={studentOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="evaluator" label="评价人" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="teacherSummary" label="综合评价" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          {dimensionNames.map((name, index) => (
            <Card size="small" key={name} title={name} className="form-subcard">
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item name={`dimension${['One', 'Two', 'Three', 'Four'][index]}Score`} label="得分" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={18}>
                  <Form.Item name={`dimension${['One', 'Two', 'Three', 'Four'][index]}Comment`} label="分析" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ))}
          <Form.Item name="strengthsText" label="优势分析">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="weaknessesText" label="劣势分析">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="suggestionsText" label="修改建议">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="追加反馈" open={feedbackModalOpen} onCancel={() => setFeedbackModalOpen(false)} onOk={() => void submitFeedback()}>
        <Form form={feedbackForm} layout="vertical">
          <Form.Item name="actor" label="反馈人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="comment" label="反馈内容" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="学生再次提交作业" open={resubmitModalOpen} onCancel={() => setResubmitModalOpen(false)} onOk={() => void submitResubmission()}>
        <Form form={resubmitForm} layout="vertical">
          <Form.Item name="note" label="本次修改说明" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Upload.Dragger
            multiple={false}
            maxCount={1}
            showUploadList
            beforeUpload={(file: RcFile) => {
              setResubmitFile(file);
              return false;
            }}
            onRemove={() => {
              setResubmitFile(undefined);
            }}
          >
            <p className="ant-upload-drag-icon">
              <BarChartOutlined />
            </p>
            <p className="ant-upload-text">上传优化后的新版本作业</p>
          </Upload.Dragger>
        </Form>
      </Modal>
    </section>
  );
}

function splitLines(value?: string) {
  return (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
