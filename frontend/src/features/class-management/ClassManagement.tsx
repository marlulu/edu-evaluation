import ReactMarkdown from 'react-markdown';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileOutlined,
  PlusOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  FileTextOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
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
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
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
  getStudent,
  listClasses,
  listStudents,
  removeWorkFromStudent,
  updateClass,
  updateStudent,
  exportClassWorksToPdf,
  exportStudentWorksToPdf,
  exportClassesWorksToPdf,
  exportStudentsWorksToPdf,
  exportStudentSelectedWorksToPdf,
} from './api';
import {
  type WorkAnalysisResult,
  type WorkTaskStatus,
  analyzeWorkAsync,
  getWorkTaskStatus,
  getWorkTaskDetail,
  listWorkTasks,
  uploadWork,
  getFileType,
  FILE_TYPE_LABELS,
  FILE_TYPE_COLORS,
} from '../work-analysis/api';
import {
  type AssignmentInfo,
  listAssignments,
} from '../assignment-management/api';

const { Text } = Typography;

// 文件类型图标
const fileTypeIconMap: Record<string, React.ReactNode> = {
  video: <VideoCameraOutlined style={{ color: '#1890ff' }} />,
  audio: <AudioOutlined style={{ color: '#52c41a' }} />,
  document: <FileTextOutlined style={{ color: '#fa8c16' }} />,
};

interface TabItem {
  key: string;
  label: string;
  type: 'classes' | 'students' | 'student-detail';
  classId?: string;
  className?: string;
  studentId?: string;
  studentName?: string;
  studentNumber?: string;
}

// 状态持久化 key
const STORAGE_KEY = 'class-management-state';

// 保存状态到 sessionStorage
function saveState(state: {
  activeTab: string;
  tabs: TabItem[];
  selectedClassId?: string;
  selectedStudentId?: string;
}) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // ignore
  }
}

// 从 sessionStorage 恢复状态
function loadState(): {
  activeTab: string;
  tabs: TabItem[];
  selectedClassId?: string;
  selectedStudentId?: string;
} | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function ClassManagement() {
  const [messageApi, contextHolder] = message.useMessage();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(false);

  // Tab 相关状态 - 从 sessionStorage 恢复
  const savedState = loadState();
  const [activeTab, setActiveTab] = useState<string>(savedState?.activeTab || 'classes');
  const [tabs, setTabs] = useState<TabItem[]>(savedState?.tabs || [
    { key: 'classes', label: '班级管理', type: 'classes' }
  ]);

  // 模态框状态
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentInfo | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<WorkAnalysisResult | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 作品分析状态
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');

  // 可选作品列表
  const [availableWorks, setAvailableWorks] = useState<Array<{ taskId: string; fileName: string; fileType?: string }>>([]);

  // 上传文件和选择任务
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | undefined>(undefined);
  const [maxKeyframes, setMaxKeyframes] = useState<number>(25);

  // 批量选择状态
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedWorkTaskIds, setSelectedWorkTaskIds] = useState<string[]>([]);

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
    setSelectedStudentIds([]); // 清空选中的学生
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
    setSelectedWorkTaskIds([]); // 清空选中的作品
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
      setAvailableWorks(result.tasks.map((t: any) => ({
        taskId: t.taskId,
        fileName: t.fileName,
        fileType: t.fileType,
      })));
    } catch (error) {
      console.error('加载作品列表失败:', error);
    }
  }, []);

  // 加载任务列表
  const loadAssignments = useCallback(async () => {
    try {
      const result = await listAssignments(undefined, 'active');
      setAssignments(result.assignments);
    } catch (error) {
      console.error('加载任务列表失败:', error);
    }
  }, []);

  // 加载作品详情
  const loadTaskDetail = useCallback(async (taskId: string) => {
    setLoadingDetail(true);
    try {
      const detail = await getWorkTaskDetail(taskId);
      setSelectedTaskDetail(detail);
      setDetailModalOpen(true);
    } catch (error) {
      messageApi.error('加载作品详情失败');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
    loadAssignments();
  }, [loadClasses, loadAssignments]);

  // 恢复选中的班级和学生（只在初始化时执行一次）
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || !savedState || classes.length === 0) return;

    if (savedState.selectedClassId) {
      const cls = classes.find(c => c.classId === savedState.selectedClassId);
      if (cls) {
        setSelectedClass(cls);
        loadStudents(cls.classId).then(() => {
          // 学生列表加载完成后，恢复选中的学生
          if (savedState.selectedStudentId) {
            // 延迟一下等待学生列表更新
            setTimeout(() => {
              loadStudentDetail(savedState.selectedStudentId!);
            }, 100);
          }
        });
      }
    }

    setInitialized(true);
  }, [classes, savedState, initialized]);

  // 保存状态到 sessionStorage
  useEffect(() => {
    if (initialized) {
      saveState({
        activeTab,
        tabs,
        selectedClassId: selectedClass?.classId,
        selectedStudentId: selectedStudent?.studentId,
      });
    }
  }, [activeTab, tabs, selectedClass, selectedStudent, initialized]);

  // 打开学生列表 Tab
  const handleViewStudents = (cls: ClassInfo) => {
    const tabKey = `class-${cls.classId}`;

    if (tabs.some(tab => tab.key === tabKey)) {
      setActiveTab(tabKey);
      setSelectedClass(cls);
      loadStudents(cls.classId);
      return;
    }

    const newTab: TabItem = {
      key: tabKey,
      label: cls.className,
      type: 'students',
      classId: cls.classId,
      className: cls.className,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(tabKey);
    setSelectedClass(cls);
    loadStudents(cls.classId);
  };

  // 打开学生详情 Tab
  const handleViewStudentDetail = (student: StudentInfo) => {
    const tabKey = `student-${student.studentId}`;

    if (tabs.some(tab => tab.key === tabKey)) {
      setActiveTab(tabKey);
      loadStudentDetail(student.studentId);
      return;
    }

    const newTab: TabItem = {
      key: tabKey,
      label: student.studentName,
      type: 'student-detail',
      studentId: student.studentId,
      studentName: student.studentName,
      studentNumber: student.studentNumber,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(tabKey);
    loadStudentDetail(student.studentId);
  };

  // 关闭 Tab
  const handleCloseTab = (targetKey: string) => {
    const newTabs = tabs.filter(tab => tab.key !== targetKey);
    setTabs(newTabs);

    if (activeTab === targetKey) {
      const lastTab = newTabs[newTabs.length - 1];
      if (lastTab) {
        setActiveTab(lastTab.key);
        if (lastTab.type === 'classes') {
          setSelectedClass(null);
          setSelectedStudent(null);
        } else if (lastTab.type === 'students' && lastTab.classId) {
          setSelectedStudent(null);
          const cls = classes.find(c => c.classId === lastTab.classId);
          if (cls) {
            setSelectedClass(cls);
            loadStudents(lastTab.classId);
          }
        } else if (lastTab.type === 'student-detail' && lastTab.studentId) {
          loadStudentDetail(lastTab.studentId);
        }
      }
    }
  };

  // 处理 tab 切换
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    const tab = tabs.find(t => t.key === key);

    if (tab) {
      if (tab.type === 'classes') {
        setSelectedClass(null);
        setSelectedStudent(null);
      } else if (tab.type === 'students' && tab.classId) {
        setSelectedStudent(null);
        const cls = classes.find(c => c.classId === tab.classId);
        if (cls) {
          setSelectedClass(cls);
          loadStudents(tab.classId);
        }
      } else if (tab.type === 'student-detail' && tab.studentId) {
        loadStudentDetail(tab.studentId);
      }
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
      handleCloseTab(`class-${classId}`);
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
      handleCloseTab(`student-${studentId}`);
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

  // 上传并分析作品（后台异步处理）
  const handleUploadAndAnalyze = async () => {
    if (!uploadFile || !selectedStudent) return;
    if (!selectedAssignmentId) {
      messageApi.error('请选择任务');
      return;
    }

    setAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStatus('上传文件中...');

    try {
      const uploadResult = await uploadWork(uploadFile);
      if (!uploadResult.success || !uploadResult.filePath) {
        throw new Error(uploadResult.message || '上传失败');
      }

      setAnalysisProgress(50);
      setAnalysisStatus('文件上传成功，提交分析任务...');

      // 获取任务的评判标准
      const assignment = assignments.find(a => a.assignmentId === selectedAssignmentId);
      const criteriaText = assignment?.criteriaText;

      const fileType = getFileType(uploadFile.name);

      // 构建分析请求参数
      const analyzeRequest: any = {
        fileName: uploadFile.name,
        filePath: uploadResult.filePath,
        fileType: fileType,
        criteriaText: criteriaText,
      };

      // 如果是视频类型，添加关键帧参数
      if (fileType === 'video') {
        analyzeRequest.options = {
          maxKeyframes: maxKeyframes,
        };
      }

      const analyzeResult = await analyzeWorkAsync(analyzeRequest);

      const taskId = analyzeResult.taskId;

      // 立即关联作品到学生
      await addWorkToStudent(selectedStudent.studentId, taskId);

      setAnalysisProgress(100);
      setAnalysisStatus('分析任务已提交！');

      messageApi.success('作品已上传并开始后台分析，可随时查看进度');

      // 关闭弹窗并重置状态
      setUploadModalOpen(false);
      setUploadFile(null);
      setSelectedAssignmentId(undefined);

      // 刷新学生详情
      loadStudentDetail(selectedStudent.studentId);

      // 启动后台轮询刷新
      startBackgroundRefresh(taskId, selectedStudent.studentId);

    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      setAnalysisStatus('提交失败');
    } finally {
      setAnalyzing(false);
    }
  };

  // 后台刷新任务状态
  const startBackgroundRefresh = useCallback((taskId: string, studentId: string) => {
    const maxAttempts = 180; // 最多 3 分钟
    let attempts = 0;

    const timer = setInterval(async () => {
      attempts++;

      try {
        const status = await getWorkTaskStatus(taskId);

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(timer);
          // 刷新学生详情
          loadStudentDetail(studentId);

          if (status.status === 'completed') {
            messageApi.success(`"${status.fileName}" 分析完成！`);
          } else {
            messageApi.error(`"${status.fileName}" 分析失败：${status.error || '未知错误'}`);
          }
        }
      } catch (err) {
        // 忽略错误，继续轮询
      }

      if (attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, 2000); // 每 2 秒检查一次

    // 返回清理函数
    return () => clearInterval(timer);
  }, [loadStudentDetail]);

  // 渲染班级列表
  const renderClassList = () => (
    <Card
      title={
        <Space>
          <TeamOutlined />
          <span>班级管理</span>
          {selectedClassIds.length > 0 && (
            <Tag color="blue">已选 {selectedClassIds.length} 个班级</Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          {selectedClassIds.length > 0 && (
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportSelectedClassesWorks}
            >
              导出选中班级作品
            </Button>
          )}
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
        </Space>
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
        rowSelection={{
          selectedRowKeys: selectedClassIds,
          onChange: (keys) => setSelectedClassIds(keys as string[]),
        }}
      />
    </Card>
  );

  // 导出全班作品
  const handleExportClassWorks = async () => {
    if (!selectedClass) return;
    try {
      await exportClassWorksToPdf(selectedClass.classId);
      messageApi.success('导出成功');
    } catch (error) {
      messageApi.error('导出失败');
    }
  };

  // 导出选中班级作品
  const handleExportSelectedClassesWorks = async () => {
    if (selectedClassIds.length === 0) return;
    try {
      await exportClassesWorksToPdf(selectedClassIds);
      messageApi.success('导出成功');
    } catch (error) {
      messageApi.error('导出失败');
    }
  };

  // 导出选中学生作品
  const handleExportSelectedStudentsWorks = async () => {
    if (selectedStudentIds.length === 0) return;
    try {
      await exportStudentsWorksToPdf(selectedStudentIds);
      messageApi.success('导出成功');
    } catch (error) {
      messageApi.error('导出失败');
    }
  };

  // 导出学生作品
  const handleExportStudentWorks = async () => {
    if (!selectedStudent) return;
    try {
      await exportStudentWorksToPdf(selectedStudent.studentId);
      messageApi.success('导出成功');
    } catch (error) {
      messageApi.error('导出失败');
    }
  };

  // 导出学生选中作品
  const handleExportStudentSelectedWorks = async () => {
    if (!selectedStudent || selectedWorkTaskIds.length === 0) return;
    try {
      await exportStudentSelectedWorksToPdf(selectedStudent.studentId, selectedWorkTaskIds);
      messageApi.success('导出成功');
    } catch (error) {
      messageApi.error('导出失败');
    }
  };

  // 渲染学生列表
  const renderStudentList = () => (
    <Card
      title={
        <Space>
          <UserOutlined />
          <span>{selectedClass?.className} - 学生管理</span>
          {selectedStudentIds.length > 0 && (
            <Tag color="blue">已选 {selectedStudentIds.length} 名学生</Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          {selectedStudentIds.length > 0 && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportSelectedStudentsWorks}
            >
              导出选中学生作品
            </Button>
          )}
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportClassWorks}
          >
            导出全班作品
          </Button>
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
        </Space>
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
        rowSelection={{
          selectedRowKeys: selectedStudentIds,
          onChange: (keys) => setSelectedStudentIds(keys as string[]),
        }}
      />
    </Card>
  );

  // 渲染学生详情
  const renderStudentDetail = () => {
    const works = selectedStudent?.works || [];
    const completedWorks = works.filter(w => w.status === 'completed').length;
    const analyzingWorks = works.filter(w => !['completed', 'failed'].includes(w.status)).length;

    return (
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>{selectedStudent?.studentName} - 作品管理</span>
            {selectedStudent?.studentNumber && (
              <Tag>{selectedStudent.studentNumber}</Tag>
            )}
            {selectedWorkTaskIds.length > 0 && (
              <Tag color="blue">已选 {selectedWorkTaskIds.length} 件作品</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            {selectedWorkTaskIds.length > 0 ? (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExportStudentSelectedWorks}
              >
                导出选中作品
              </Button>
            ) : (
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportStudentWorks}
              >
                导出该生作品
              </Button>
            )}
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalOpen(true)}
            >
              上传并分析
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
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="作品总数"
                value={selectedStudent?.workCount || 0}
                prefix={<FileOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="已完成分析"
                value={completedWorks}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="分析中"
                value={analyzingWorks}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 作品列表 */}
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
              width: 200,
              render: (_: unknown, record: WorkInfo) => (
                <Space>
                  {record.status === 'completed' && (
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<EyeOutlined />}
                      onClick={() => loadTaskDetail(record.taskId)}
                      loading={loadingDetail}
                    >
                      查看详情
                    </Button>
                  )}
                  <Popconfirm
                    title="确定取消关联此作品？"
                    onConfirm={() => handleRemoveWork(record.taskId)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      取消关联
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          dataSource={works}
          rowKey="taskId"
          loading={loading}
          locale={{ emptyText: <Empty description="暂无作品，点击右上角上传或关联" /> }}
          pagination={works.length > 10 ? { pageSize: 10 } : false}
          size="small"
          rowSelection={{
            selectedRowKeys: selectedWorkTaskIds,
            onChange: (keys) => setSelectedWorkTaskIds(keys as string[]),
          }}
        />
      </Card>
    );
  };

  // 渲染当前 tab 内容
  const renderTabContent = () => {
    const currentTab = tabs.find(t => t.key === activeTab);
    if (!currentTab) return null;

    switch (currentTab.type) {
      case 'classes':
        return renderClassList();
      case 'students':
        return renderStudentList();
      case 'student-detail':
        return renderStudentDetail();
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: 0 }}>
      {contextHolder}

      <Tabs
        type="editable-card"
        activeKey={activeTab}
        onChange={handleTabChange}
        onEdit={(targetKey, action) => {
          if (action === 'remove') {
            handleCloseTab(targetKey as string);
          }
        }}
        hideAdd
        items={tabs.map(tab => ({
          key: tab.key,
          label: (
            <span>
              {tab.type === 'classes' && <TeamOutlined style={{ marginRight: 4 }} />}
              {tab.type === 'students' && <TeamOutlined style={{ marginRight: 4 }} />}
              {tab.type === 'student-detail' && <UserOutlined style={{ marginRight: 4 }} />}
              {tab.label}
            </span>
          ),
          children: renderTabContent(),
          closable: tab.key !== 'classes',
        }))}
        style={{ marginBottom: 0 }}
        tabBarStyle={{ marginBottom: 0, paddingLeft: 16, background: '#fff' }}
      />

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

      {/* 上传并分析模态框 */}
      <Modal
        title="上传并分析作品"
        open={uploadModalOpen}
        onCancel={() => {
          if (!analyzing) {
            setUploadModalOpen(false);
            setUploadFile(null);
            setSelectedAssignmentId(undefined);
          }
        }}
        footer={analyzing ? null : [
          <Button key="cancel" onClick={() => {
            setUploadModalOpen(false);
            setUploadFile(null);
            setSelectedAssignmentId(undefined);
          }}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            disabled={!uploadFile || !selectedAssignmentId}
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
            <div style={{ marginBottom: 16 }}>
              <Text strong>选择任务：</Text>
              <Select
                placeholder="请选择任务"
                style={{ width: '100%', marginTop: 8 }}
                value={selectedAssignmentId}
                onChange={setSelectedAssignmentId}
              >
                {assignments.map(a => (
                  <Select.Option key={a.assignmentId} value={a.assignmentId}>
                    {a.title}
                    {a.criteriaText ? <Tag color="success" style={{ marginLeft: 8 }}>有评判标准</Tag> : null}
                  </Select.Option>
                ))}
              </Select>
            </div>

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
              <p className="ant-upload-hint">支持视频、音频、文档等多种格式</p>
            </Upload.Dragger>

            {/* 文件类型显示 */}
            {uploadFile && (
              <div style={{ marginTop: 16 }}>
                <Space>
                  <Text strong>文件类型：</Text>
                  <Tag color={
                    getFileType(uploadFile.name) === 'video' ? 'blue' :
                    getFileType(uploadFile.name) === 'audio' ? 'green' : 'orange'
                  }>
                    {getFileType(uploadFile.name) === 'video' ? '视频' :
                     getFileType(uploadFile.name) === 'audio' ? '音频' : '文档'}
                  </Tag>
                  <Text type="secondary">{uploadFile.name}</Text>
                </Space>
              </div>
            )}

            {/* 视频关键帧设置 */}
            {uploadFile && getFileType(uploadFile.name) === 'video' && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0f5ff', borderRadius: 8, border: '1px solid #d6e4ff' }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space>
                    <Text strong>🎬 视频关键帧设置</Text>
                    <Tag color="blue">视频文件专属</Tag>
                  </Space>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Text>关键帧数量：</Text>
                    <Select
                      value={maxKeyframes}
                      onChange={setMaxKeyframes}
                      style={{ width: 120 }}
                    >
                      <Select.Option value={10}>10 帧</Select.Option>
                      <Select.Option value={15}>15 帧</Select.Option>
                      <Select.Option value={20}>20 帧</Select.Option>
                      <Select.Option value={25}>25 帧</Select.Option>
                      <Select.Option value={30}>30 帧</Select.Option>
                      <Select.Option value={50}>50 帧</Select.Option>
                    </Select>
                    <Text type="secondary">（默认 25 帧，帧数越多分析越详细，但耗时更长）</Text>
                  </div>
                </Space>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <Text type="secondary">支持的文件类型：</Text>
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

      {/* 作品详情弹窗 */}
      <Modal
        title="作品分析详情"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedTaskDetail(null);
        }}
        footer={null}
        width={900}
        style={{ top: 20 }}
      >
        {selectedTaskDetail && (
          <TaskDetailView task={selectedTaskDetail} />
        )}
      </Modal>
    </div>
  );
}

// 任务详情组件
function TaskDetailView({ task }: { task: WorkAnalysisResult }) {
  const statusLabels: Record<WorkTaskStatus, string> = {
    pending: '等待中',
    preprocessing: '预处理中',
    extracting_metadata: '提取元数据',
    extracting_keyframes: '提取关键帧',
    extracting_audio: '提取音频',
    transcribing: '语音识别中',
    analyzing_content: '分析内容中',
    completed: '分析完成',
    failed: '分析失败',
  };

  const statusColors: Record<WorkTaskStatus, string> = {
    pending: 'default',
    preprocessing: 'processing',
    extracting_metadata: 'processing',
    extracting_keyframes: 'processing',
    extracting_audio: 'processing',
    transcribing: 'processing',
    analyzing_content: 'processing',
    completed: 'success',
    failed: 'error',
  };

  const stageOrder: WorkTaskStatus[] = [
    'pending',
    'preprocessing',
    'extracting_metadata',
    'extracting_keyframes',
    'extracting_audio',
    'transcribing',
    'analyzing_content',
    'completed',
  ];

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const stepsStages = stageOrder.slice(1, -1);
  const currentStep = stepsStages.indexOf(task.status);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', maxHeight: '70vh', overflow: 'auto' }}>
      {/* 基本信息 */}
      <Card title="任务信息" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="文件名">{task.fileName}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColors[task.status]}>{statusLabels[task.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="进度">
            <Progress percent={task.progress} size="small" />
          </Descriptions.Item>
          <Descriptions.Item label="处理时间">
            {task.processingTimeMs
              ? `${(task.processingTimeMs / 1000).toFixed(1)} 秒`
              : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Steps
          current={currentStep}
          size="small"
          style={{ marginTop: 16 }}
          status={task.status === 'failed' ? 'error' : task.status === 'completed' ? 'finish' : 'process'}
          items={stepsStages.map((stage) => ({
            title: statusLabels[stage],
          }))}
        />

        {task.error && (
          <div style={{ marginTop: 16, color: '#ff4d4f' }}>
            <Text type="danger">错误：{task.error}</Text>
          </div>
        )}
      </Card>

      {/* 视频元数据 */}
      {task.metadata && (
        <Card title="视频信息" size="small">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="时长">
              {formatDuration((task.metadata as any).durationSeconds ?? (task.metadata as any).duration_seconds ?? 0)}
            </Descriptions.Item>
            <Descriptions.Item label="分辨率">
              {task.metadata.width} × {task.metadata.height}
            </Descriptions.Item>
            <Descriptions.Item label="帧率">
              {(task.metadata.fps ?? 0).toFixed(1)} fps
            </Descriptions.Item>
            <Descriptions.Item label="编码">{task.metadata.codec}</Descriptions.Item>
            <Descriptions.Item label="文件大小">
              {formatFileSize((task.metadata as any).fileSize ?? (task.metadata as any).file_size ?? 0)}
            </Descriptions.Item>
            <Descriptions.Item label="音频">
              {((task.metadata as any).hasAudio ?? (task.metadata as any).has_audio) ? (
                <Tag color="green">有音频</Tag>
              ) : (
                <Tag color="default">无音频</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 技术质量 */}
      {task.technicalQuality && (
        <Card title="技术质量评估" size="small">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="视频质量">
              <Tag>{(task.technicalQuality as any).videoQuality ?? (task.technicalQuality as any).video_quality}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="音频质量">
              <Tag>{(task.technicalQuality as any).audioQuality ?? (task.technicalQuality as any).audio_quality}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="稳定性">
              <Tag>{task.technicalQuality.stability}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="综合评分">
              <Progress
                percent={(task.technicalQuality as any).overallScore ?? (task.technicalQuality as any).overall_score}
                size="small"
                style={{ width: 120 }}
              />
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 关键帧 */}
      {task.keyframes && task.keyframes.length > 0 && (
        <Card title={`关键帧 (${task.keyframes.length} 帧)`} size="small">
          <Row gutter={[16, 16]}>
            {task.keyframes.slice(0, 8).map((frame: any) => (
              <Col key={frame.frameId ?? frame.frame_id} span={6}>
                <Card
                  hoverable
                  size="small"
                  cover={
                    (frame.imageBase64 ?? frame.image_base64 ?? frame.imagePath ?? frame.image_path) ? (
                      <img
                        src={frame.imageBase64 ?? frame.image_base64 ?? frame.imagePath ?? frame.image_path}
                        alt={`帧 ${frame.frameIndex ?? frame.frame_index}`}
                        style={{ height: 80, objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          height: 80,
                          background: '#f0f0f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <VideoCameraOutlined style={{ fontSize: 24 }} />
                      </div>
                    )
                  }
                >
                  <Card.Meta
                    title={
                      <Text style={{ fontSize: 12 }}>
                        {formatDuration(frame.timestampSeconds ?? frame.timestamp_seconds ?? 0)}
                      </Text>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
          {task.keyframes.length > 8 && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <Text type="secondary">还有 {task.keyframes.length - 8} 帧...</Text>
            </div>
          )}
        </Card>
      )}

      {/* 语音转录 */}
      {task.audioAnalysis && (task.audioAnalysis as any).transcription?.length > 0 && (
        <Card
          title={
            <Space>
              <AudioOutlined />
              <span>语音转录</span>
              <Tag>{((task.audioAnalysis as any).detectedLanguage ?? (task.audioAnalysis as any).detected_language) === 'zh' ? '中文' : '英文'}</Tag>
            </Space>
          }
          size="small"
          extra={
            <Space>
              <Text type="secondary">
                语速：{((task.audioAnalysis as any).averageSpeechRate ?? (task.audioAnalysis as any).average_speech_rate ?? 0).toFixed(0)} 字/分钟
              </Text>
            </Space>
          }
        >
          <Table
            dataSource={(task.audioAnalysis as any).transcription}
            rowKey={(record: any) => `${record.startTime ?? record.start_time}-${record.endTime ?? record.end_time}`}
            size="small"
            pagination={{ pageSize: 5 }}
            columns={[
              {
                key: 'time',
                title: '时间',
                width: 120,
                render: (_: any, record: any) => (
                  <Text type="secondary">
                    {formatDuration(record.startTime ?? record.start_time ?? 0)} - {formatDuration(record.endTime ?? record.end_time ?? 0)}
                  </Text>
                ),
              },
              {
                key: 'text',
                title: '内容',
                dataIndex: 'text',
              },
            ]}
          />
        </Card>
      )}

      {/* 内容分析 */}
      {task.contentAnalysis && (
        <ContentAnalysisDetailView analysis={task.contentAnalysis} />
      )}

      {/* 警告信息 */}
      {task.warnings && task.warnings.length > 0 && (
        <Card title="警告信息" size="small">
          {task.warnings.map((warning, index) => (
            <div key={index} style={{ color: '#faad14' }}>
              ⚠️ {warning}
            </div>
          ))}
        </Card>
      )}
    </Space>
  );
}

// 评分等级颜色
function getGradeColor(grade: string): string {
  if (grade.includes('优秀')) return '#52c41a';
  if (grade.includes('良好')) return '#1890ff';
  if (grade.includes('合格') || grade.includes('中等') || grade.includes('及格')) return '#faad14';
  return '#ff4d4f';
}

// 评分结果展示组件
function EvaluationDetailView({ evaluation }: { evaluation: any }) {
  const totalScore = evaluation.totalScore ?? evaluation.total_score ?? 0;
  const grade = evaluation.grade ?? '';
  const scores: any[] = evaluation.scores ?? [];
  const strengths: string[] = evaluation.strengths ?? [];
  const weaknesses: string[] = evaluation.weaknesses ?? [];
  const prioritySuggestions: string[] = evaluation.prioritySuggestions ?? evaluation.priority_suggestions ?? [];
  const rawText: string | undefined = evaluation.rawText ?? evaluation.raw_text;

  if (rawText && scores.length === 0) {
    return (
      <Card
        title="评分结果"
        size="small"
        style={{ background: 'linear-gradient(135deg, #f6f8ff 0%, #f0f5ff 100%)', border: '1px solid #d6e4ff' }}
      >
        <div className="markdown-body">
          <ReactMarkdown>{rawText}</ReactMarkdown>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="评分结果"
      size="small"
      style={{ background: 'linear-gradient(135deg, #f6f8ff 0%, #f0f5ff 100%)', border: '1px solid #d6e4ff' }}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 总分和等级 */}
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: getGradeColor(grade), lineHeight: 1 }}>
            {totalScore.toFixed(1)}
          </div>
          <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>/ 100</div>
          {grade && (
            <Tag
              color={getGradeColor(grade)}
              style={{ fontSize: 14, padding: '4px 12px', marginTop: 8 }}
            >
              {grade}
            </Tag>
          )}
        </div>

        {/* 各维度得分 */}
        {scores.length > 0 && (
          <div>
            <Text strong style={{ fontSize: 14 }}>各维度得分</Text>
            <div style={{ marginTop: 8 }}>
              {scores.map((item: any, index: number) => {
                const dim = item.dimension ?? '';
                const max = item.maxScore ?? item.max_score ?? 100;
                const sc = item.score ?? 0;
                const pct = max > 0 ? Math.round((sc / max) * 100) : 0;
                const evidence = item.evidence ?? '';
                const suggestion = item.suggestion ?? '';

                return (
                  <div key={index} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>{dim}</Text>
                      <Text strong>{sc} / {max}</Text>
                    </div>
                    <Progress
                      percent={pct}
                      strokeColor={pct >= 80 ? '#52c41a' : pct >= 60 ? '#1890ff' : pct >= 40 ? '#faad14' : '#ff4d4f'}
                      size="small"
                    />
                    {evidence && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        📋 {evidence}
                      </div>
                    )}
                    {suggestion && (
                      <div style={{ fontSize: 12, color: '#1890ff', marginTop: 2 }}>
                        💡 {suggestion}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 优点和不足 */}
        <Row gutter={12}>
          {strengths.length > 0 && (
            <Col span={12}>
              <Card size="small" title="✅ 优点" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                <List
                  size="small"
                  dataSource={strengths}
                  renderItem={(item: string, index: number) => (
                    <List.Item key={index} style={{ padding: '4px 0', border: 'none' }}>
                      <Text style={{ fontSize: 13 }}>{item}</Text>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          )}
          {weaknesses.length > 0 && (
            <Col span={12}>
              <Card size="small" title="⚠️ 不足" style={{ background: '#fff2e8', border: '1px solid #ffbb96' }}>
                <List
                  size="small"
                  dataSource={weaknesses}
                  renderItem={(item: string, index: number) => (
                    <List.Item key={index} style={{ padding: '4px 0', border: 'none' }}>
                      <Text style={{ fontSize: 13 }}>{item}</Text>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          )}
        </Row>

        {/* 优先改进建议 */}
        {prioritySuggestions.length > 0 && (
          <div>
            <Text strong style={{ fontSize: 14 }}>🎯 优先改进建议</Text>
            <List
              size="small"
              style={{ marginTop: 8 }}
              dataSource={prioritySuggestions}
              renderItem={(item: string, index: number) => (
                <List.Item key={index}>
                  <Text style={{ fontSize: 13 }}>
                    <Tag color={index === 0 ? 'red' : index === 1 ? 'orange' : 'blue'}>
                      {index === 0 ? '最紧迫' : index === 1 ? '次重要' : '锦上添花'}
                    </Tag>
                    {item}
                  </Text>
                </List.Item>
              )}
            />
          </div>
        )}
      </Space>
    </Card>
  );
}

// 内容分析详情组件
function ContentAnalysisDetailView({ analysis }: { analysis: any }) {
  const overallTopic = analysis.overallTopic ?? analysis.overall_topic ?? '未知';
  const summary = analysis.summary ?? '';
  const keyPoints: string[] = analysis.keyPoints ?? analysis.key_points ?? [];
  const keywords: string[] = analysis.keywords ?? [];
  const evaluation = analysis.evaluation ?? null;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* 评分结果 */}
      {evaluation && <EvaluationDetailView evaluation={evaluation} />}

      <Card title="内容分析" size="small">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {/* 主题 */}
          <div>
            <Text strong>主题：</Text>
            <Tag color="blue">{overallTopic}</Tag>
          </div>

          {/* 摘要 */}
          <div>
            <Text strong>内容摘要：</Text>
            <div style={{ marginTop: 8, padding: '10px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
              <div className="markdown-body">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            </div>
          </div>

          {/* 关键点 */}
          {keyPoints.length > 0 && (
            <div>
              <Text strong>关键要点：</Text>
              <List
                size="small"
                dataSource={keyPoints.slice(0, 5)}
                renderItem={(point: string, index: number) => (
                  <List.Item key={index} style={{ padding: '4px 0' }}>
                    <Text style={{ fontSize: 13 }}>{index + 1}. {point}</Text>
                  </List.Item>
                )}
              />
              {keyPoints.length > 5 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  还有 {keyPoints.length - 5} 条...
                </Text>
              )}
            </div>
          )}

          {/* 关键词 */}
          {keywords.length > 0 && (
            <div>
              <Text strong>关键词：</Text>
              <div style={{ marginTop: 8 }}>
                {keywords.map((keyword: string) => (
                  <Tag key={keyword} style={{ marginBottom: 4 }}>
                    {keyword}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </Space>
      </Card>
    </Space>
  );
}
