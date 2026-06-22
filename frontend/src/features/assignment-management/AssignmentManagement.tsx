import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message
} from 'antd';
import type { UploadFile } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type Assignment,
  type AssignmentCategory,
  type AssignmentInput,
  type AssignmentStatus,
  type CategoryInput,
  type ClassInput,
  type CourseClass,
  type Student,
  type StudentInput,
  deleteAssignment,
  deleteCategory,
  deleteClass,
  deleteStudent,
  exportAssignments,
  fetchAssignmentData,
  getApiErrorMessage,
  importAssignments,
  saveAssignment,
  saveCategory,
  saveClass,
  saveStudent,
  uploadAssignmentVersion
} from './api';

const { Paragraph, Text, Title } = Typography;

const statusOptions: { label: string; value: AssignmentStatus; color: string }[] = [
  { label: '草稿', value: 'DRAFT', color: 'default' },
  { label: '已发布', value: 'PUBLISHED', color: 'processing' },
  { label: '已提交', value: 'SUBMITTED', color: 'success' },
  { label: '复核中', value: 'REVIEWING', color: 'warning' },
  { label: '已完成', value: 'COMPLETED', color: 'green' },
  { label: '已归档', value: 'ARCHIVED', color: 'default' }
];

type AssignmentFormValues = AssignmentInput;
type UploadFormValues = { studentId: string; note?: string };

export function AssignmentManagement() {
  const [apiMessage, contextHolder] = message.useMessage();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [categories, setCategories] = useState<AssignmentCategory[]>([]);
  const [classes, setClasses] = useState<CourseClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | undefined>();
  const [uploadAssignment, setUploadAssignment] = useState<Assignment | undefined>();
  const [uploadFile, setUploadFile] = useState<File | undefined>();
  const [assignmentForm] = Form.useForm<AssignmentFormValues>();
  const [uploadForm] = Form.useForm<UploadFormValues>();
  const [categoryForm] = Form.useForm<CategoryInput>();
  const [classForm] = Form.useForm<ClassInput>();
  const [studentForm] = Form.useForm<StudentInput>();

  const categoryOptions = categories.map((category) => ({ label: category.name, value: category.id }));
  const classOptions = classes.map((courseClass) => ({ label: courseClass.name, value: courseClass.id }));
  const studentOptions = students.map((student) => ({ label: `${student.studentNo} ${student.name}`, value: student.id }));
  const statusLabelByValue = useMemo(() => new Map(statusOptions.map((status) => [status.value, status])), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAssignmentData();
      setAssignments(data.assignments);
      setCategories(data.categories);
      setClasses(data.classes);
      setStudents(data.students);
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [apiMessage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openAssignmentModal(assignment?: Assignment) {
    setEditingAssignment(assignment);
    assignmentForm.setFieldsValue(
      assignment ?? {
        title: '',
        description: '',
        categoryId: categories[0]?.id,
        classId: classes[0]?.id,
        status: 'PUBLISHED',
        dueAt: ''
      }
    );
    setAssignmentModalOpen(true);
  }

  async function submitAssignment() {
    try {
      const values = await assignmentForm.validateFields();
      await saveAssignment(values, editingAssignment?.id);
      apiMessage.success('作业已保存');
      setAssignmentModalOpen(false);
      await loadData();
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function removeAssignment(id: string) {
    try {
      await deleteAssignment(id);
      apiMessage.success('作业已删除');
      await loadData();
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function submitUpload() {
    try {
      const values = await uploadForm.validateFields();
      if (!uploadAssignment || !uploadFile) {
        apiMessage.warning('请选择要上传的文件');
        return;
      }
      await uploadAssignmentVersion(uploadAssignment.id, values.studentId, values.note ?? '', uploadFile);
      apiMessage.success('作业文件已上传并生成新版本');
      setUploadAssignment(undefined);
      setUploadFile(undefined);
      uploadForm.resetFields();
      await loadData();
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function submitCategory(values: CategoryInput) {
    try {
      await saveCategory(values);
      categoryForm.resetFields();
      await loadData();
      apiMessage.success('分类已保存');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function submitClass(values: ClassInput) {
    try {
      await saveClass(values);
      classForm.resetFields();
      await loadData();
      apiMessage.success('班级已保存');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function submitStudent(values: StudentInput) {
    try {
      await saveStudent(values);
      studentForm.resetFields();
      await loadData();
      apiMessage.success('学生已保存');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function removeCategory(id: string) {
    try {
      await deleteCategory(id);
      await loadData();
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function removeClass(id: string) {
    try {
      await deleteClass(id);
      await loadData();
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function removeStudent(id: string) {
    try {
      await deleteStudent(id);
      await loadData();
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function handleImport(file: RcFile) {
    try {
      const result = await importAssignments(file);
      await loadData();
      if (result.errors.length > 0) {
        apiMessage.warning(`导入 ${result.imported} 条，${result.errors.length} 条失败`);
      } else {
        apiMessage.success(`导入 ${result.imported} 条作业`);
      }
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
    return Upload.LIST_IGNORE;
  }

  const assignmentColumns = [
    {
      title: '作业',
      dataIndex: 'title',
      render: (title: string, record: Assignment) => (
        <Space direction="vertical" size={2}>
          <Text strong>{title}</Text>
          <Text type="secondary">{record.description}</Text>
        </Space>
      )
    },
    { title: '分类', dataIndex: 'categoryName' },
    { title: '班级', dataIndex: 'className' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: AssignmentStatus) => {
        const option = statusLabelByValue.get(status);
        return <Tag color={option?.color}>{option?.label ?? status}</Tag>;
      }
    },
    { title: '版本', dataIndex: 'currentVersion', width: 80 },
    { title: '截止时间', dataIndex: 'dueAt', render: (value: string) => value || '未设置' },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, record: Assignment) => (
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setUploadAssignment(record)}>
            上传
          </Button>
          <Button icon={<EditOutlined />} onClick={() => openAssignmentModal(record)} />
          <Popconfirm title="确认删除该作业？" onConfirm={() => void removeAssignment(record.id)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
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
              <Title level={2}>作业管理模块</Title>
              <Paragraph type="secondary">
                当前实现不依赖 AI：支持作业增删改查、学生上传、多版本记录、状态跟踪、分类、班级、学生和 CSV 批量导入导出。
              </Paragraph>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
                刷新
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => void exportAssignments()}>
                导出作业
              </Button>
              <Upload accept=".csv" showUploadList={false} beforeUpload={(file) => void handleImport(file)}>
                <Button icon={<UploadOutlined />}>导入 CSV</Button>
              </Upload>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openAssignmentModal()}>
                新建作业
              </Button>
            </Space>
          </Space>

          <Tabs
            items={[
              {
                key: 'assignments',
                label: '作业与版本',
                children: (
                  <Table
                    rowKey="id"
                    loading={loading}
                    columns={assignmentColumns}
                    dataSource={assignments}
                    expandable={{
                      expandedRowRender: (assignment) => (
                        <Table
                          rowKey="id"
                          size="small"
                          pagination={false}
                          dataSource={assignment.versions}
                          columns={[
                            { title: '版本', dataIndex: 'version' },
                            { title: '学生', dataIndex: 'studentName' },
                            { title: '文件', dataIndex: 'fileName' },
                            { title: '类型', dataIndex: 'contentType' },
                            { title: '大小', dataIndex: 'size', render: (size: number) => `${Math.ceil(size / 1024)} KB` },
                            { title: '说明', dataIndex: 'note' },
                            { title: '提交时间', dataIndex: 'submittedAt' }
                          ]}
                        />
                      )
                    }}
                  />
                )
              },
              {
                key: 'categories',
                label: '分类管理',
                children: (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={8}>
                      <Card title="新增分类">
                        <Form form={categoryForm} layout="vertical" onFinish={(values) => void submitCategory(values)}>
                          <Form.Item name="name" label="分类名称" rules={[{ required: true }]}>
                            <Input />
                          </Form.Item>
                          <Form.Item name="description" label="说明">
                            <Input.TextArea rows={3} />
                          </Form.Item>
                          <Button type="primary" htmlType="submit">
                            保存分类
                          </Button>
                        </Form>
                      </Card>
                    </Col>
                    <Col xs={24} lg={16}>
                      <Table
                        rowKey="id"
                        dataSource={categories}
                        columns={[
                          { title: '分类名称', dataIndex: 'name' },
                          { title: '说明', dataIndex: 'description' },
                          {
                            title: '操作',
                            render: (_: unknown, record: AssignmentCategory) => (
                              <Popconfirm title="确认删除该分类？" onConfirm={() => void removeCategory(record.id)}>
                                <Button danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            )
                          }
                        ]}
                      />
                    </Col>
                  </Row>
                )
              },
              {
                key: 'people',
                label: '学生与班级',
                children: (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} xl={8}>
                      <Card title="新增班级">
                        <Form form={classForm} layout="vertical" onFinish={(values) => void submitClass(values)}>
                          <Form.Item name="name" label="班级名称" rules={[{ required: true }]}>
                            <Input />
                          </Form.Item>
                          <Form.Item name="grade" label="年级">
                            <Input />
                          </Form.Item>
                          <Form.Item name="description" label="说明">
                            <Input.TextArea rows={3} />
                          </Form.Item>
                          <Button type="primary" htmlType="submit">
                            保存班级
                          </Button>
                        </Form>
                      </Card>
                    </Col>
                    <Col xs={24} xl={16}>
                      <Table
                        rowKey="id"
                        dataSource={classes}
                        columns={[
                          { title: '班级', dataIndex: 'name' },
                          { title: '年级', dataIndex: 'grade' },
                          { title: '学生数', dataIndex: 'studentCount' },
                          { title: '说明', dataIndex: 'description' },
                          {
                            title: '操作',
                            render: (_: unknown, record: CourseClass) => (
                              <Popconfirm title="确认删除该班级？" onConfirm={() => void removeClass(record.id)}>
                                <Button danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            )
                          }
                        ]}
                      />
                    </Col>
                    <Col xs={24} xl={8}>
                      <Card title="新增学生">
                        <Form form={studentForm} layout="vertical" initialValues={{ status: 'ACTIVE' }} onFinish={(values) => void submitStudent(values)}>
                          <Form.Item name="studentNo" label="学号" rules={[{ required: true }]}>
                            <Input />
                          </Form.Item>
                          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
                            <Input />
                          </Form.Item>
                          <Form.Item name="classId" label="班级" rules={[{ required: true }]}>
                            <Select options={classOptions} />
                          </Form.Item>
                          <Form.Item name="email" label="邮箱">
                            <Input />
                          </Form.Item>
                          <Form.Item name="phone" label="电话">
                            <Input />
                          </Form.Item>
                          <Form.Item name="status" label="状态">
                            <Select
                              options={[
                                { label: '在读', value: 'ACTIVE' },
                                { label: '停用', value: 'INACTIVE' }
                              ]}
                            />
                          </Form.Item>
                          <Button type="primary" htmlType="submit">
                            保存学生
                          </Button>
                        </Form>
                      </Card>
                    </Col>
                    <Col xs={24} xl={16}>
                      <Table
                        rowKey="id"
                        dataSource={students}
                        columns={[
                          { title: '学号', dataIndex: 'studentNo' },
                          { title: '姓名', dataIndex: 'name' },
                          { title: '班级', dataIndex: 'className' },
                          { title: '邮箱', dataIndex: 'email' },
                          { title: '电话', dataIndex: 'phone' },
                          { title: '状态', dataIndex: 'status', render: (status: string) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status === 'ACTIVE' ? '在读' : '停用'}</Tag> },
                          {
                            title: '操作',
                            render: (_: unknown, record: Student) => (
                              <Popconfirm title="确认删除该学生？" onConfirm={() => void removeStudent(record.id)}>
                                <Button danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            )
                          }
                        ]}
                      />
                    </Col>
                  </Row>
                )
              }
            ]}
          />
        </Space>
      </Card>

      <Modal title={editingAssignment ? '编辑作业' : '新建作业'} open={assignmentModalOpen} onCancel={() => setAssignmentModalOpen(false)} onOk={() => void submitAssignment()}>
        <Form form={assignmentForm} layout="vertical">
          <Form.Item name="title" label="作业标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="作业说明">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="categoryId" label="分类" rules={[{ required: true }]}>
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item name="classId" label="班级" rules={[{ required: true }]}>
            <Select options={classOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={statusOptions.map((status) => ({ label: status.label, value: status.value }))} />
          </Form.Item>
          <Form.Item name="dueAt" label="截止时间">
            <Input placeholder="例如 2026-07-01 23:59" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="上传作业文件" open={Boolean(uploadAssignment)} onCancel={() => setUploadAssignment(undefined)} onOk={() => void submitUpload()}>
        <Form form={uploadForm} layout="vertical">
          <Form.Item label="作业">
            <Text>{uploadAssignment?.title}</Text>
          </Form.Item>
          <Form.Item name="studentId" label="学生" rules={[{ required: true }]}>
            <Select options={studentOptions} />
          </Form.Item>
          <Form.Item name="note" label="版本说明">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Upload.Dragger
            multiple={false}
            maxCount={1}
            fileList={uploadFile ? ([{ uid: uploadFile.name, name: uploadFile.name, status: 'done' }] as UploadFile[]) : []}
            beforeUpload={(file) => {
              setUploadFile(file);
              return false;
            }}
            onRemove={() => {
              setUploadFile(undefined);
            }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">选择或拖拽作业文件</p>
            <p className="ant-upload-hint">支持图片、视频、音频、压缩包、PDF、Office、TXT/Markdown 等常见文件。</p>
          </Upload.Dragger>
        </Form>
      </Modal>
    </section>
  );
}
