import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  LockOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  type AssignmentInfo,
  createAssignment,
  deleteAssignment,
  closeAssignment,
  listAssignments,
  updateAssignment,
} from './api';
import { listClasses, type ClassInfo } from '../class-management/api';
import { uploadCriteria, parseCriteriaFile } from '../work-analysis/api';

const { Text } = Typography;
const { TextArea } = Input;

export function AssignmentManagement() {
  const [messageApi, contextHolder] = message.useMessage();
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // 模态框状态
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentInfo | null>(null);

  // 评判标准文件状态
  const [criteriaFile, setCriteriaFile] = useState<File | undefined>();
  const [criteriaText, setCriteriaText] = useState<string | undefined>();
  const [criteriaParsing, setCriteriaParsing] = useState(false);

  // 表单
  const [form] = Form.useForm();

  // 加载任务列表
  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAssignments();
      setAssignments(result.assignments);
    } catch (error) {
      messageApi.error('加载任务列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载班级列表
  const loadClasses = useCallback(async () => {
    try {
      const result = await listClasses();
      setClasses(result.classes);
    } catch (error) {
      console.error('加载班级列表失败:', error);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
    loadClasses();
  }, [loadAssignments, loadClasses]);

  // 处理评判标准文件变化
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
          form.setFieldsValue({ criteriaText: parseResult.text });
        } else {
          messageApi.warning('评判标准文件解析失败');
        }
      }
    } catch (error) {
      console.error('解析评判标准文件失败:', error);
      messageApi.warning('评判标准文件解析失败');
    } finally {
      setCriteriaParsing(false);
    }
  };

  // 创建/编辑任务
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        title: values.title,
        description: values.description,
        criteriaText: values.criteriaText,
        classId: values.classId || undefined,
        deadline: values.deadline ? values.deadline.toISOString() : undefined,
      };

      if (editingAssignment) {
        await updateAssignment(editingAssignment.assignmentId, data);
        messageApi.success('任务更新成功');
      } else {
        await createAssignment(data);
        messageApi.success('任务创建成功');
      }

      setModalOpen(false);
      form.resetFields();
      setEditingAssignment(null);
      setCriteriaFile(undefined);
      setCriteriaText(undefined);
      loadAssignments();
    } catch (error) {
      messageApi.error('操作失败');
    }
  };

  // 删除任务
  const handleDelete = async (assignmentId: string) => {
    try {
      await deleteAssignment(assignmentId);
      messageApi.success('任务删除成功');
      loadAssignments();
    } catch (error) {
      messageApi.error('删除失败');
    }
  };

  // 关闭任务
  const handleClose = async (assignmentId: string) => {
    try {
      await closeAssignment(assignmentId);
      messageApi.success('任务已关闭');
      loadAssignments();
    } catch (error) {
      messageApi.error('关闭失败');
    }
  };

  // 获取班级名称
  const getClassName = (classId?: string) => {
    if (!classId) return '所有班级';
    const cls = classes.find(c => c.classId === classId);
    return cls ? cls.className : classId;
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  // 判断是否已过期
  const isExpired = (deadline?: string) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  // 打开编辑模态框
  const openEditModal = (record?: AssignmentInfo) => {
    if (record) {
      setEditingAssignment(record);
      setCriteriaText(record.criteriaText);
      setCriteriaFile(undefined);
      form.setFieldsValue({
        title: record.title,
        description: record.description,
        criteriaText: record.criteriaText,
        classId: record.classId,
        deadline: record.deadline ? new Date(record.deadline) : undefined,
      });
    } else {
      setEditingAssignment(null);
      setCriteriaFile(undefined);
      setCriteriaText(undefined);
      form.resetFields();
    }
    setModalOpen(true);
  };

  return (
    <Card
      title={
        <Space>
          <FileTextOutlined />
          <span>布置任务</span>
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openEditModal()}
        >
          布置任务
        </Button>
      }
    >
      {contextHolder}

      <Table
        columns={[
          {
            title: '任务标题',
            dataIndex: 'title',
            key: 'title',
            render: (text: string) => <Text strong>{text}</Text>,
          },
          {
            title: '班级',
            dataIndex: 'classId',
            key: 'classId',
            width: 120,
            render: (classId: string) => (
              <Tag color="blue">{getClassName(classId)}</Tag>
            ),
          },
          {
            title: '评判标准',
            dataIndex: 'criteriaText',
            key: 'criteriaText',
            width: 100,
            render: (text: string) => (
              text ? <Tag color="success">已设置</Tag> : <Tag color="default">未设置</Tag>
            ),
          },
          {
            title: '截止时间',
            dataIndex: 'deadline',
            key: 'deadline',
            width: 180,
            render: (deadline: string) => {
              if (!deadline) return <Text type="secondary">无限制</Text>;
              const expired = isExpired(deadline);
              return (
                <Text type={expired ? 'danger' : undefined}>
                  {formatDate(deadline)}
                  {expired && ' (已过期)'}
                </Text>
              );
            },
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            render: (status: string) => (
              <Tag color={status === 'active' ? 'success' : 'default'}>
                {status === 'active' ? '进行中' : '已关闭'}
              </Tag>
            ),
          },
          {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (time: string) => formatDate(time),
          },
          {
            title: '操作',
            key: 'action',
            width: 250,
            render: (_: unknown, record: AssignmentInfo) => (
              <Space>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEditModal(record)}
                >
                  编辑
                </Button>
                {record.status === 'active' && (
                  <Popconfirm
                    title="确定关闭此任务？"
                    onConfirm={() => handleClose(record.assignmentId)}
                  >
                    <Button size="small" icon={<LockOutlined />}>
                      关闭
                    </Button>
                  </Popconfirm>
                )}
                <Popconfirm
                  title="确定删除此任务？"
                  onConfirm={() => handleDelete(record.assignmentId)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        dataSource={assignments}
        rowKey="assignmentId"
        loading={loading}
        locale={{ emptyText: <div style={{ padding: 40, textAlign: 'center' }}>暂无任务，点击右上角布置</div> }}
        pagination={assignments.length > 10 ? { pageSize: 10 } : false}
      />

      {/* 任务编辑模态框 */}
      <Modal
        title={editingAssignment ? '编辑任务' : '布置任务'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
          setEditingAssignment(null);
          setCriteriaFile(undefined);
          setCriteriaText(undefined);
        }}
        okText={editingAssignment ? '保存' : '创建'}
        width={700}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="任务标题"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
            <Input placeholder="例如：第一次作业 - 视频分析" />
          </Form.Item>

          <Form.Item name="description" label="任务描述">
            <TextArea placeholder="请输入任务描述（可选）" rows={3} />
          </Form.Item>

          <Form.Item name="classId" label="指定班级">
            <Select placeholder="选择班级（不选则所有班级可见）" allowClear>
              {classes.map(cls => (
                <Select.Option key={cls.classId} value={cls.classId}>
                  {cls.className}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="deadline" label="截止时间">
            <DatePicker
              showTime
              placeholder="选择截止时间（可选）"
              style={{ width: '100%' }}
            />
          </Form.Item>

          {/* 评判标准文件上传 */}
          <Form.Item label="评判标准文件">
            <div style={{ marginBottom: 8 }}>
              <Upload
                beforeUpload={(file) => {
                  handleCriteriaFileChange(file);
                  return false;
                }}
                fileList={criteriaFile ? [{ uid: criteriaFile.name, name: criteriaFile.name, status: 'done' }] : []}
                onRemove={() => {
                  setCriteriaFile(undefined);
                  setCriteriaText(undefined);
                  form.setFieldsValue({ criteriaText: undefined });
                }}
                accept=".pdf,.docx,.doc,.txt"
                maxCount={1}
              >
                <Button icon={<UploadOutlined />} loading={criteriaParsing}>
                  上传评判标准文件
                </Button>
              </Upload>
              <Text type="secondary" style={{ fontSize: 12 }}>
                支持 PDF、Word、TXT 格式，上传后自动解析内容
              </Text>
            </div>

            {criteriaParsing && (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <Spin tip="正在解析评判标准文件..." />
              </div>
            )}

            {criteriaText && !criteriaParsing && (
              <div style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>解析结果预览：</Text>
                <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 4 }}>
                  <Text style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
                    {criteriaText.length > 500 ? criteriaText.substring(0, 500) + '...' : criteriaText}
                  </Text>
                </div>
              </div>
            )}
          </Form.Item>

          <Form.Item name="criteriaText" label="评判标准内容" hidden>
            <TextArea rows={8} />
          </Form.Item>

          <div style={{ marginTop: -8, marginBottom: 16 }}>
            <Text type="secondary">
              评判标准将作为 AI 分析作品时的评分依据，支持详细的评分维度和标准描述。
            </Text>
          </div>
        </Form>
      </Modal>
    </Card>
  );
}
