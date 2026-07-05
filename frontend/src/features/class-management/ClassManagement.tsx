import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  PlusOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
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
import {
  type WorkAnalysisResult,
  analyzeWorkAsync,
  getWorkTaskStatus,
  listWorkTasks,
  uploadWork,
  getFileType,
  FILE_TYPE_LABELS,
  FILE_TYPE_COLORS,
} from '../work-analysis/api';

const { Paragraph, Text, Title } = Typography;

type ViewMode = 'classes' | 'students' | 'student-detail';

// 文件类型图标
const fileTypeIconMap: Record<string, React.ReactNode> = {
  video: <VideoCameraOutlined style={{ color: '#1890ff' }} />,
  audio: <AudioOutlined style={{ color: '#52c41a' }} />,
  document: <FileTextOutlined style={{ color: '#fa8c16' }} />,
};

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
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentInfo | null>(null);

  // 作品分析状态
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');

  // 表单
  const [classForm] = Form.useForm();
  const [studentForm] = Form.useForm();

  // 可选作品列表
  const [availableWorks, setAvailableWorks] = useState<Array<{ taskId: string; fileName: string; fileType?: string }>>([]);

  // 上传文件
  const [uploadFile, setUploadFile] = useState<File | null>(null);

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
      setAvailableWorks(result.tasks.map(t => ({
        taskId: t.taskId,
        fileName: t.fileName,
        fileType: (t as any).fileType,
      })));
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

  // 上传并分析作品
  const handleUploadAndAnalyze = async () => {
    if (!uploadFile || !selectedStudent) return;

    setAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStatus('上传文件中...');

    try {
      // 1. 上传文件
      const uploadResult = await uploadWork(uploadFile);
      if (!uploadResult.success || !uploadResult.filePath) {
        throw new Error(uploadResult.message || '上传失败');
      }

      setAnalysisProgress(20);
      setAnalysisStatus('文件上传成功，开始分析...');

      // 2. 提交分析任务
      const fileType = getFileType(uploadFile.name);
      const analyzeResult = await analyzeWorkAsync({
        fileName: uploadFile.name,
        filePath: uploadResult.filePath,
        fileType: fileType,
      });

      setAnalysisProgress(40);
      setAnalysisStatus('分析任务已提交，正在处理...');

      // 3. 轮询等待分析完成
      const taskId = analyzeResult.taskId;
      let attempts = 0;
      const maxAttempts = 120; // 最多等待 2 分钟

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

        try {
          const status = await getWorkTaskStatus(taskId);
          const progress = Math.min(40 + (status.progress * 0.6), 100);
          setAnalysisProgress(progress);

          if (status.status === 'completed') {
            setAnalysisStatus('分析完成！');
            setAnalysisProgress(100);

            // 关联到学生
            await addWorkToStudent(selectedStudent.studentId, taskId);
            messageApi.success('作品分析完成并已关联到学生');

            // 刷新学生详情
            loadStudentDetail(selectedStudent.studentId);
            setUploadModalOpen(false);
            setUploadFile(null);
            break;
          } else if (status.status === 'failed') {
            throw new Error(status.error || '分析失败');
          } else {
            setAnalysisStatus(`分析中... ${Math.round(status.progress)}%`);
          }
        } catch (err: any) {
          if (attempts >= maxAttempts) {
            throw new Error('分析超时');
          }
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error('分析超时，请稍后查看结果');
      }
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      setAnalysisStatus('分析失败');
    } finally {
      setAnalyzing(false);
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
            width: 220,
            render: (_: unknown, record: StudentInfo) => (
              <Space>
                <Button
                  type="primary"
                  ghost
                  size="small"
                  icon={<FileOutlined />}
                  onClick={() => handleViewStudentDetail(record)}
                >
                  查看作品
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

  // 渲染学生详情
  const renderStudentDetail = () => {
    const works = selectedStudent?.works || [];
    const completedWorks = works.filter(w => w.status === 'completed').length;
    const analyzingWorks = works.filter(w => !['completed', 'failed'].includes(w.status)).length;

    return (
      <div>
        {/* 返回按钮和标题 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
              返回学生列表
            </Button>
            <Divider type="vertical" />
            <UserOutlined />
            <Text strong style={{ fontSize: 16 }}>{selectedStudent?.studentName}</Text>
            {selectedStudent?.studentNumber && (
              <Tag>{selectedStudent.studentNumber}</Tag>
            )}
          </Space>
        </Card>

        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="作品总数"
                value={selectedStudent?.workCount || 0}
                prefix={<FileOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="已完成分析"
                value={completedWorks}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="分析中"
                value={analyzingWorks}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 作品列表 */}
        <Card
          title={
            <Space>
              <FileOutlined />
              <span>作品列表</span>
            </Space>
          }
          extra={
            <Space>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setUploadModalOpen(true)}
              >
                上传并分析作品
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  loadAvailableWorks();
                  setWorkModalOpen(true);
                }}
              >
                关联已有作品
              </Button>
            </Space>
          }
        >
          <Table
            columns={[
              {
                title: '作品名称',
                dataIndex: 'fileName',
                key: 'fileName',
                render: (text: string, record: WorkInfo) => (
                  <Space>
                    {fileTypeIconMap[record.fileType || ''] || <FileOutlined />}
                    <Text>{text}</Text>
                  </Space>
                ),
              },
              {
                title: '文件类型',
                dataIndex: 'fileType',
                key: 'fileType',
                width: 100,
                render: (type: string) => (
                  <Tag color={FILE_TYPE_COLORS[type as keyof typeof FILE_TYPE_COLORS] || 'default'}>
                    {FILE_TYPE_LABELS[type as keyof typeof FILE_TYPE_LABELS] || type || '未知'}
                  </Tag>
                ),
              },
              {
                title: '分析状态',
                dataIndex: 'status',
                key: 'status',
                width: 120,
                render: (status: string) => {
                  const statusMap: Record<string, { color: string; text: string }> = {
                    completed: { color: 'success', text: '已完成' },
                    failed: { color: 'error', text: '失败' },
                    pending: { color: 'default', text: '等待中' },
                    preprocessing: { color: 'processing', text: '预处理' },
                    extracting_metadata: { color: 'processing', text: '提取元数据' },
                    extracting_keyframes: { color: 'processing', text: '提取关键帧' },
                    extracting_audio: { color: 'processing', text: '提取音频' },
                    transcribing: { color: 'processing', text: '语音识别' },
                    analyzing_content: { color: 'processing', text: '内容分析' },
                  };
                  const info = statusMap[status] || { color: 'default', text: status };
                  return <Tag color={info.color}>{info.text}</Tag>;
                },
              },
              {
                title: '进度',
                dataIndex: 'progress',
                key: 'progress',
                width: 120,
                render: (progress: number, record: WorkInfo) => (
                  <Progress
                    percent={Math.round(progress || 0)}
                    size="small"
                    status={record.status === 'failed' ? 'exception' : undefined}
                  />
                ),
              },
              {
                title: '操作',
                key: 'action',
                width: 100,
                render: (_: unknown, record: WorkInfo) => (
                  <Popconfirm
                    title="确定取消关联此作品？"
                    onConfirm={() => handleRemoveWork(record.taskId)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      取消关联
                    </Button>
                  </Popconfirm>
                ),
              },
            ]}
            dataSource={works}
            rowKey="taskId"
            loading={loading}
            locale={{ emptyText: <Empty description="暂无作品，点击右上角上传或关联" /> }}
            pagination={works.length > 10 ? { pageSize: 10 } : false}
          />
        </Card>

        {/* 上传并分析模态框 */}
        <Modal
          title="上传并分析作品"
          open={uploadModalOpen}
          onCancel={() => {
            if (!analyzing) {
              setUploadModalOpen(false);
              setUploadFile(null);
            }
          }}
          footer={analyzing ? null : [
            <Button key="cancel" onClick={() => {
              setUploadModalOpen(false);
              setUploadFile(null);
            }}>
              取消
            </Button>,
            <Button
              key="submit"
              type="primary"
              disabled={!uploadFile}
              loading={analyzing}
              onClick={handleUploadAndAnalyze}
            >
              上传并分析
            </Button>,
          ]}
        >
          {analyzing ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Progress
                type="circle"
                percent={Math.round(analysisProgress)}
                status={analysisStatus.includes('失败') ? 'exception' : undefined}
              />
              <div style={{ marginTop: 16 }}>
                <Text>{analysisStatus}</Text>
              </div>
            </div>
          ) : (
            <div>
              <Upload.Dragger
                beforeUpload={(file) => {
                  setUploadFile(file);
                  return false;
                }}
                fileList={uploadFile ? [uploadFile as any] : []}
                onRemove={() => setUploadFile(null)}
                accept=".mp4,.avi,.mov,.mkv,.webm,.flv,.wmv,.m4v,.3gp,.mp3,.wav,.flac,.aac,.ogg,.wma,.m4a,.opus,.pdf,.doc,.docx,.txt,.md,.ppt,.pptx,.xls,.xlsx"
                maxCount={1}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">
                  支持视频、音频、文档等多种格式
                </p>
              </Upload.Dragger>

              <div style={{ marginTop: 16 }}>
                <Text type="secondary">
                  支持的文件类型：
                </Text>
                <div style={{ marginTop: 8 }}>
                  <Space wrap>
                    <Tag color="blue">视频：mp4, avi, mov, mkv 等</Tag>
                    <Tag color="green">音频：mp3, wav, flac 等</Tag>
                    <Tag color="orange">文档：pdf, doc, docx, txt 等</Tag>
                  </Space>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* 关联作品模态框 */}
        <Modal
          title="关联已有作品"
          open={workModalOpen}
          onCancel={() => setWorkModalOpen(false)}
          footer={null}
          width={700}
        >
          <Table
            columns={[
              {
                title: '作品名称',
                dataIndex: 'fileName',
                key: 'fileName',
                render: (text: string, record: any) => (
                  <Space>
                    {fileTypeIconMap[record.fileType || ''] || <FileOutlined />}
                    <Text>{text}</Text>
                  </Space>
                ),
              },
              {
                title: '文件类型',
                dataIndex: 'fileType',
                key: 'fileType',
                width: 100,
                render: (type: string) => (
                  <Tag color={FILE_TYPE_COLORS[type as keyof typeof FILE_TYPE_COLORS] || 'default'}>
                    {FILE_TYPE_LABELS[type as keyof typeof FILE_TYPE_LABELS] || type || '未知'}
                  </Tag>
                ),
              },
              {
                title: '操作',
                key: 'action',
                width: 100,
                render: (_: unknown, record: { taskId: string }) => (
                  <Button
                    type="primary"
                    size="small"
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
            pagination={availableWorks.length > 10 ? { pageSize: 10 } : false}
            locale={{ emptyText: <Empty description="暂无可关联的作品" /> }}
          />
        </Modal>
      </div>
    );
  };

  return (
    <div style={{ padding: 0 }}>
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
