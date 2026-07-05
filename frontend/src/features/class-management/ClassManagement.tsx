import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  type ClassInfo,
  type StudentInfo,
  createClass,
  createStudent,
  deleteClass,
  deleteStudent,
  listClasses,
  listStudents,
  updateClass,
  updateStudent,
} from './api';

const { Text } = Typography;

type ViewMode = 'classes' | 'students';

export function ClassManagement() {
  const [messageApi, contextHolder] = message.useMessage();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('classes');
  const [loading, setLoading] = useState(false);

  // 模态框状态
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentInfo | null>(null);

  // 表单
  const [classForm] = Form.useForm();
  const [studentForm] = Form.useForm();

  // 加载班级列表
  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listClasses();
      setClasses(result.classes);
    } catch (error) {
      messageApi.error('加载班级列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载学生列表
  const loadStudents = useCallback(async (classId: string) => {
    setLoading(true);
    try {
      const result = await listStudents(classId);
      setStudents(result.students);
    } catch (error) {
      messageApi.error('加载学生列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // 切换到学生列表
  const handleViewStudents = (cls: ClassInfo) => {
    setSelectedClass(cls);
    setViewMode('students');
    loadStudents(cls.classId);
  };

  // 在新 Tab 页打开学生详情
  const handleViewStudentDetail = (student: StudentInfo) => {
    window.open(`#/student/${student.studentId}`, '_blank');
  };

  // 返回上级
  const handleBack = () => {
    setViewMode('classes');
    setSelectedClass(null);
    setStudents([]);
  };

  // 创建/编辑班级
  const handleClassSubmit = async () => {
    try {
      const values = await classForm.validateFields();
      if (editingClass) {
        await updateClass(editingClass.classId, values.className, values.description);
        messageApi.success('班级更新成功');
      } else {
        await createClass(values.className, values.description);
        messageApi.success('班级创建成功');
      }
      setClassModalOpen(false);
      classForm.resetFields();
      setEditingClass(null);
      loadClasses();
    } catch (error) {
      messageApi.error('操作失败');
    }
  };

  // 删除班级
  const handleDeleteClass = async (classId: string) => {
    try {
      await deleteClass(classId);
      messageApi.success('班级删除成功');
      loadClasses();
    } catch (error) {
      messageApi.error('删除失败');
    }
  };

  // 创建/编辑学生
  const handleStudentSubmit = async () => {
    try {
      const values = await studentForm.validateFields();
      if (editingStudent) {
        await updateStudent(editingStudent.studentId, values.studentName, values.studentNumber);
        messageApi.success('学生更新成功');
      } else {
        if (!selectedClass) return;
        await createStudent(selectedClass.classId, values.studentName, values.studentNumber);
        messageApi.success('学生添加成功');
      }
      setStudentModalOpen(false);
      studentForm.resetFields();
      setEditingStudent(null);
      if (selectedClass) {
        loadStudents(selectedClass.classId);
      }
    } catch (error) {
      messageApi.error('操作失败');
    }
  };

  // 删除学生
  const handleDeleteStudent = async (studentId: string) => {
    try {
      await deleteStudent(studentId);
      messageApi.success('学生删除成功');
      if (selectedClass) {
        loadStudents(selectedClass.classId);
      }
    } catch (error) {
      messageApi.error('删除失败');
    }
  };

  // 渲染班级列表
  const renderClassList = () => (
    <Card
      title={
        <Space>
          <TeamOutlined />
          <span>班级管理</span>
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingClass(null);
            classForm.resetFields();
            setClassModalOpen(true);
          }}
        >
          创建班级
        </Button>
      }
    >
      <Table
        columns={[
          {
            title: '班级名称',
            dataIndex: 'className',
            key: 'className',
            render: (text: string) => <Text strong>{text}</Text>,
          },
          {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (text: string) => text || <Text type="secondary">-</Text>,
          },
          {
            title: '学生数量',
            dataIndex: 'studentCount',
            key: 'studentCount',
            width: 100,
            align: 'center',
            render: (count: number) => (
              <Tag color="blue" style={{ minWidth: 40, textAlign: 'center' }}>
                {count || 0}
              </Tag>
            ),
          },
          {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (time: string) => time ? new Date(time).toLocaleString('zh-CN') : '-',
          },
          {
            title: '操作',
            key: 'action',
            width: 220,
            render: (_: unknown, record: ClassInfo) => (
              <Space>
                <Button
                  type="primary"
                  ghost
                  size="small"
                  icon={<TeamOutlined />}
                  onClick={() => handleViewStudents(record)}
                >
                  学生管理
                </Button>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingClass(record);
                    classForm.setFieldsValue({ className: record.className, description: record.description });
                    setClassModalOpen(true);
                  }}
                >
                  编辑
                </Button>
                <Popconfirm
                  title="确定删除此班级？"
                  description="删除后将同时删除班级下的所有学生"
                  onConfirm={() => handleDeleteClass(record.classId)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        dataSource={classes}
        rowKey="classId"
        loading={loading}
        locale={{ emptyText: <Empty description="暂无班级，点击右上角创建" /> }}
        pagination={classes.length > 10 ? { pageSize: 10 } : false}
      />
    </Card>
  );

  // 渲染学生列表
  const renderStudentList = () => (
    <Card
      title={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack} />
          <Divider type="vertical" />
          <UserOutlined />
          <span>{selectedClass?.className} - 学生管理</span>
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingStudent(null);
            studentForm.resetFields();
            setStudentModalOpen(true);
          }}
        >
          添加学生
        </Button>
      }
    >
      <Table
        columns={[
          {
            title: '学生姓名',
            dataIndex: 'studentName',
            key: 'studentName',
            render: (text: string) => <Text strong>{text}</Text>,
          },
          {
            title: '学号',
            dataIndex: 'studentNumber',
            key: 'studentNumber',
            render: (text: string) => text || <Text type="secondary">-</Text>,
          },
          {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (time: string) => time ? new Date(time).toLocaleString('zh-CN') : '-',
          },
          {
            title: '操作',
            key: 'action',
            width: 280,
            render: (_: unknown, record: StudentInfo) => (
              <Space>
                <Button
                  type="primary"
                  ghost
                  size="small"
                  icon={<FileOutlined />}
                  onClick={() => handleViewStudentDetail(record)}
                >
                  查看作品（新窗口）
                </Button>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingStudent(record);
                    studentForm.setFieldsValue({ studentName: record.studentName, studentNumber: record.studentNumber });
                    setStudentModalOpen(true);
                  }}
                >
                  编辑
                </Button>
                <Popconfirm
                  title="确定删除此学生？"
                  onConfirm={() => handleDeleteStudent(record.studentId)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        dataSource={students}
        rowKey="studentId"
        loading={loading}
        locale={{ emptyText: <Empty description="暂无学生，点击右上角添加" /> }}
        pagination={students.length > 10 ? { pageSize: 10 } : false}
      />
    </Card>
  );

  return (
    <div style={{ padding: 0 }}>
      {contextHolder}
      {viewMode === 'classes' && renderClassList()}
      {viewMode === 'students' && renderStudentList()}

      {/* 班级编辑模态框 */}
      <Modal
        title={editingClass ? '编辑班级' : '创建班级'}
        open={classModalOpen}
        onOk={handleClassSubmit}
        onCancel={() => {
          setClassModalOpen(false);
          classForm.resetFields();
          setEditingClass(null);
        }}
        okText={editingClass ? '保存' : '创建'}
      >
        <Form form={classForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="className"
            label="班级名称"
            rules={[{ required: true, message: '请输入班级名称' }]}
          >
            <Input placeholder="例如：2024级计算机1班" />
          </Form.Item>
          <Form.Item name="description" label="班级描述">
            <Input.TextArea placeholder="请输入班级描述（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 学生编辑模态框 */}
      <Modal
        title={editingStudent ? '编辑学生' : '添加学生'}
        open={studentModalOpen}
        onOk={handleStudentSubmit}
        onCancel={() => {
          setStudentModalOpen(false);
          studentForm.resetFields();
          setEditingStudent(null);
        }}
        okText={editingStudent ? '保存' : '添加'}
      >
        <Form form={studentForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="studentName"
            label="学生姓名"
            rules={[{ required: true, message: '请输入学生姓名' }]}
          >
            <Input placeholder="请输入学生姓名" />
          </Form.Item>
          <Form.Item name="studentNumber" label="学号">
            <Input placeholder="请输入学号（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
