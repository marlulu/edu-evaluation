import { BookOutlined, FileTextOutlined } from '@ant-design/icons';
import { Card, Col, Row, Space, Table, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAssignmentData, getApiErrorMessage, type Assignment, type Student } from '../assignment-management/api';
import { fetchResultData, type ResultReport } from '../result-feedback/api';

const { Paragraph, Text, Title } = Typography;

type StudentWorkspaceProps = {
  username: string;
};

export function StudentWorkspace({ username }: StudentWorkspaceProps) {
  const [apiMessage, contextHolder] = message.useMessage();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reports, setReports] = useState<ResultReport[]>([]);
  const [student, setStudent] = useState<Student | undefined>();

  const loadData = useCallback(async () => {
    try {
      const [assignmentData, resultData] = await Promise.all([fetchAssignmentData(), fetchResultData()]);
      const currentStudent = assignmentData.students.find((item) => item.studentNo === username);
      setStudent(currentStudent);
      setAssignments(
        currentStudent
          ? assignmentData.assignments.filter((assignment) => assignment.classId === currentStudent.classId)
          : []
      );
      setReports(
        currentStudent ? resultData.snapshot.reports.filter((report) => report.studentId === currentStudent.id) : []
      );
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }, [apiMessage, username]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const latestReport = useMemo(() => reports[0], [reports]);

  return (
    <section>
      {contextHolder}
      <Space direction="vertical" size={20} className="content-stack">
        <div>
          <Title level={2}>我的学习反馈</Title>
          <Paragraph type="secondary">
            查看当前课程作业、历史评价记录和教师反馈，围绕问题项继续修改并再次提交。
          </Paragraph>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card>
              <Space direction="vertical" size={8}>
                <Text type="secondary">当前学生</Text>
                <Title level={4} className="compact-title">
                  {student?.name ?? '未匹配到学生档案'}
                </Title>
                <Text>{student ? `${student.studentNo} / ${student.className}` : '请检查登录账号与学生编号是否一致。'}</Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Space direction="vertical" size={8}>
                <Text type="secondary">最新评价结果</Text>
                <Title level={4} className="compact-title">
                  {latestReport ? `${latestReport.overallScore} 分` : '暂无评价记录'}
                </Title>
                <Text>{latestReport?.teacherSummary ?? '老师发布评价后会在这里展示。'}</Text>
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card title="当前作业">
              <Table
                rowKey="id"
                pagination={false}
                dataSource={assignments}
                columns={[
                  {
                    title: '作业',
                    render: (_: unknown, assignment: Assignment) => (
                      <Space direction="vertical" size={2}>
                        <Space>
                          <BookOutlined />
                          <Text strong>{assignment.title}</Text>
                        </Space>
                        <Text type="secondary">{assignment.description}</Text>
                      </Space>
                    )
                  },
                  { title: '状态', dataIndex: 'status', render: (status: string) => <Tag>{status}</Tag> },
                  { title: '版本', dataIndex: 'currentVersion', width: 80 }
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card title="我的评价报告">
              <Table
                rowKey="id"
                pagination={false}
                dataSource={reports}
                columns={[
                  {
                    title: '报告',
                    render: (_: unknown, report: ResultReport) => (
                      <Space direction="vertical" size={2}>
                        <Space>
                          <FileTextOutlined />
                          <Text strong>{report.assignmentTitle}</Text>
                        </Space>
                        <Text type="secondary">版本 v{report.sourceVersionNumber}</Text>
                      </Space>
                    )
                  },
                  { title: '得分', dataIndex: 'overallScore', width: 80 },
                  { title: '反馈摘要', dataIndex: 'teacherSummary' }
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </section>
  );
}
