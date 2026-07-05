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
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  type ClassInfo,
  type StudentInfo,
  type WorkInfo,
  addWorkToStudent,
  createClass,
  createStudent,
  deleteClass,
  deleteStudent,
  getClass,
  getStudent,
  listClasses,
  listStudents,
  removeWorkFromStudent,
  updateClass,
  updateStudent,
} from './api';
import { getWorkTaskStatus, listWorkTasks } from '../work-analysis/api';

const { Paragraph, Text, Title } = Typography;

type ViewMode = 'classes' | 'students' | 'student-detail';

export function ClassManagement() {
  const [messageApi, contextHolder] = message.useMessage();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('classes');
  const [loading, setLoading] = useState(false);

  // 模态框状态
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentInfo | null>(null);

  // 表单
  const [classForm] = Form.useForm();
  const [studentForm] = Form.useForm();

  // 可选作品列表
  const [availableWorks, setAvailableWorks] = useState<Array<{ taskId: string; fileName: string }>>([]);

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

  // 加载学生详情
  const loadStudentDetail = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const student = await getStudent(studentId);
      setSelectedStudent(student);
    } catch (error) {
      messageApi.error('加载学生详情失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载可选作品列表
  const loadAvailableWorks = useCallback(async () => {
    try {
      const result = await listWorkTasks();
      setAvailableWorks(result.tasks.map(t => ({ taskId: t.taskId, fileName: t.fileName })));
    } catch (error) {
      console.error('加载作品列表失败:', error);
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

  // 切换到学生详情
  const handleViewStudentDetail = (student: StudentInfo) => {
    setViewMode('student-detail');
    loadStudentDetail(student.studentId);
  };

  // 返回上级
  const handleBack = () => {
    if (viewMode === 'student-detail') {
      setViewMode('students');
      setSelectedStudent(null);
    } else if (viewMode === 'students') {
      setViewMode('classes');
      setSelectedClass(null);
      setStudents([]);
    }
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

  // 关联作品
  const handleAddWork = async (taskId: string) => {
    if (!selectedStudent) return;
    try {
      await addWorkToStudent(selectedStudent.studentId, taskId);
      messageApi.success('作品关联成功');
      loadStudentDetail(selectedStudent.studentId);
      setWorkModalOpen(false);
    } catch (error) {
      messageApi.error('关联失败');
    }
  };

  // 取消关联作品
  const handleRemoveWork = async (taskId: string) => {
    if (!selectedStudent) return;
    try {
      await removeWorkFromStudent(selectedStudent.studentId, taskId);
      messageApi.success('取消关联成功');
      loadStudentDetail(selectedStudent.studentId);
    } catch (error) {
      messageApi.error('取消关联失败');
    }
  };

  // 班级列表列定义
  const classColumns = [
    {
      title: '班级名称',
      dataIndex: 'className',
      key: 'className',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '学生数量',
      dataIndex: 'studentCount',
      key: 'studentCount',
      width: 100,
      render: (count: number) => <Tag color="blue">{count || 0}</Tag>,
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
      width: 250,
      render: (_: unknown, record: ClassInfo) => (
        <Space>
          <Button
            type="link"
            icon={<TeamOutlined />}
            onClick={() => handleViewStudents(record)}
          >
            查看学生
          </Button>
          <Button
            type="link"
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
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 学生列表列定义
  const studentColumns = [
    {
      title: '学生姓名',
      dataIndex: 'studentName',
      key: 'studentName',
    },
    {
      title: '学号',
      dataIndex: 'studentNumber',
      key: 'studentNumber',
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
      width: 250,
      render: (_: unknown, record: StudentInfo) => (
        <Space>
          <Button
            type="link"
            icon={<UserOutlined />}
            onClick={() => handleViewStudentDetail(record)}
          >
            查看详情
          </Button>
          <Button
            type="link"
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
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 作品列表列定义
  const workColumns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
    },
    {
      title: '文件类型',
      dataIndex: 'fileType',
      key: 'fileType',
      width: 100,
      render: (type: string) => {
        const colorMap: Record<string, string> = { video: 'blue', audio: 'green', document: 'orange' };
        const labelMap: Record<string, string> = { video: '视频', audio: '音频', document: '文档' };
        return <Tag color={colorMap[type] || 'default'}>{labelMap[type] || type || '未知'}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          completed: 'success',
          failed: 'error',
          processing: 'processing',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 80,
      render: (progress: number) => `${Math.round(progress || 0)}%`,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: WorkInfo) => (
        <Popconfirm
          title="确定取消关联此作品？"
          onConfirm={() => handleRemoveWork(record.taskId)}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            取消关联
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // 渲染班级列表
  const renderClassList = () => (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4}>班级列表</Title>
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
      </div>
      <Table
        columns={classColumns}
        dataSource={classes}
        rowKey="classId"
        loading={loading}
        locale={{ emptyText: <Empty description="暂无班级" /> }}
      />
    </>
  );

  // 渲染学生列表
  const renderStudentList = () => (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Title level={4}>{selectedClass?.className} - 学生列表</Title>
        </Space>
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
      </div>
      <Table
        columns={studentColumns}
        dataSource={students}
        rowKey="studentId"
        loading={loading}
        locale={{ emptyText: <Empty description="暂无学生" /> }}
      />
    </>
  );

  // 渲染学生详情
  const renderStudentDetail = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Title level={4}>{selectedStudent?.studentName} - 作品列表</Title>
        </Space>
      </div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Text type="secondary">学生姓名：</Text>
            <Text strong>{selectedStudent?.studentName}</Text>
          </Col>
          <Col span={8}>
            <Text type="secondary">学号：</Text>
            <Text>{selectedStudent?.studentNumber || '-'}</Text>
          </Col>
          <Col span={8}>
            <Text type="secondary">作品数量：</Text>
            <Tag color="blue">{selectedStudent?.workCount || 0}</Tag>
          </Col>
        </Row>
      </Card>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={5}>关联作品</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            loadAvailableWorks();
            setWorkModalOpen(true);
          }}
        >
          关联作品
        </Button>
      </div>
      <Table
        columns={workColumns}
        dataSource={selectedStudent?.works || []}
        rowKey="taskId"
        loading={loading}
        locale={{ emptyText: <Empty description="暂无关联作品" /> }}
      />
    </>
  );

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      {viewMode === 'classes' && renderClassList()}
      {viewMode === 'students' && renderStudentList()}
      {viewMode === 'student-detail' && renderStudentDetail()}

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
      >
        <Form form={classForm} layout="vertical">
          <Form.Item
            name="className"
            label="班级名称"
            rules={[{ required: true, message: '请输入班级名称' }]}
          >
            <Input placeholder="请输入班级名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入班级描述" rows={3} />
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
      >
        <Form form={studentForm} layout="vertical">
          <Form.Item
            name="studentName"
            label="学生姓名"
            rules={[{ required: true, message: '请输入学生姓名' }]}
          >
            <Input placeholder="请输入学生姓名" />
          </Form.Item>
          <Form.Item name="studentNumber" label="学号">
            <Input placeholder="请输入学号" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 关联作品模态框 */}
      <Modal
        title="关联作品"
        open={workModalOpen}
        onCancel={() => setWorkModalOpen(false)}
        footer={null}
        width={600}
      >
        <Table
          columns={[
            { title: '文件名', dataIndex: 'fileName', key: 'fileName' },
            {
              title: '操作',
              key: 'action',
              width: 100,
              render: (_: unknown, record: { taskId: string }) => (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => handleAddWork(record.taskId)}
                >
                  关联
                </Button>
              ),
            },
          ]}
          dataSource={availableWorks}
          rowKey="taskId"
          size="small"
          pagination={false}
        />
      </Modal>
    </div>
  );
}
