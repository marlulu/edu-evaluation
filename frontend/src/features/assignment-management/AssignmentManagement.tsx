import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  LockOutlined,
  PlusOutlined,
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
  Table,
  Tag,
  Typography,
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
          onClick={() => {
            setEditingAssignment(null);
            form.resetFields();
            setModalOpen(true);
          }}
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
                  onClick={() => {
                    setEditingAssignment(record);
                    form.setFieldsValue({
                      title: record.title,
                      description: record.description,
                      criteriaText: record.criteriaText,
                      classId: record.classId,
                      deadline: record.deadline ? new Date(record.deadline) : undefined,
                    });
                    setModalOpen(true);
                  }}
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

          <Form.Item name="criteriaText" label="评判标准">
            <TextArea
              placeholder="请输入评判标准内容，将用于作品分析时的评分依据"
              rows={8}
            />
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
