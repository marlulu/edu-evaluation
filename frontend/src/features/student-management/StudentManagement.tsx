import { DeleteOutlined, DownloadOutlined, EditOutlined, ExportOutlined, PlusOutlined, SearchOutlined, UploadOutlined, UserAddOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, Upload, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Key } from 'react';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';

const { Paragraph, Text, Title } = Typography;
type Group = { id: string; name: string; studentCount: number };
type Student = { id: string; studentNumber: string; studentName: string; email: string | null; groupNames: string[]; initialPassword: string | null };
type StudentForm = { studentNumber: string; studentName: string; email?: string; groupIds?: string[] };
type ImportRow = { rowNumber: number; studentNumber: string; studentName: string; email: string | null; valid: boolean; issue: string | null };
type ImportPreview = { draftId: string; rows: ImportRow[]; validCount: number; invalidCount: number };
type Credential = { studentNumber: string; studentName: string; initialPassword: string };

export function StudentManagement() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [keyword, setKeyword] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>();
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group>();
  const [editing, setEditing] = useState<Student>();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importGroups, setImportGroups] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreview>();
  const [importing, setImporting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [studentForm] = Form.useForm<StudentForm>();
  const [groupForm] = Form.useForm<{ name: string }>();

  const load = useCallback(async () => {
    try {
      const [studentResponse, groupResponse] = await Promise.all([
        axios.get<Student[]>('/api/students'),
        axios.get<Group[]>('/api/students/groups')
      ]);
      setStudents(studentResponse.data);
      setGroups(groupResponse.data);
    } catch {
      messageApi.error('学生数据加载失败');
    }
  }, [messageApi]);

  useEffect(() => { void load(); }, [load]);

  const currentGroup = groups.find((group) => group.id === activeGroup);
  const visibleStudents = useMemo(() => students.filter((student) => {
    const term = keyword.trim().toLowerCase();
    const matchesKeyword = !term || `${student.studentName}${student.studentNumber}${student.email ?? ''}`.toLowerCase().includes(term);
    return matchesKeyword && (!currentGroup || student.groupNames.includes(currentGroup.name));
  }), [currentGroup, keyword, students]);

  function openStudent(student?: Student) {
    setEditing(student);
    const groupIds = student ? groups.filter((group) => student.groupNames.includes(group.name)).map((group) => group.id) : [];
    studentForm.setFieldsValue(student
      ? { studentNumber: student.studentNumber, studentName: student.studentName, email: student.email ?? undefined, groupIds }
      : { studentNumber: '', studentName: '', groupIds: [] });
    setStudentModalOpen(true);
  }

  async function saveStudent() {
    const values = await studentForm.validateFields();
    try {
      if (editing) await axios.put(`/api/students/${editing.id}`, values);
      else await axios.post('/api/students', values);
      setStudentModalOpen(false);
      await load();
      messageApi.success('学生信息已保存');
    } catch {
      messageApi.error('学生信息保存失败');
    }
  }

  async function createGroup() {
    const values = await groupForm.validateFields();
    try {
      if (editingGroup) await axios.put(`/api/students/groups/${editingGroup.id}`, values);
      else await axios.post('/api/students/groups', values);
      setGroupModalOpen(false);
      setEditingGroup(undefined);
      groupForm.resetFields();
      await load();
    } catch {
      messageApi.error('组别创建失败');
    }
  }

  function openGroup(group?: Group) {
    setEditingGroup(group);
    groupForm.setFieldsValue({ name: group?.name ?? '' });
    setGroupModalOpen(true);
  }

  async function deleteGroup(group: Group) {
    try {
      await axios.delete(`/api/students/groups/${group.id}`);
      if (activeGroup === group.id) setActiveGroup(undefined);
      await load();
      messageApi.success('组别已删除');
    } catch {
      messageApi.error('组别删除失败');
    }
  }

  async function deleteStudent(student: Student) {
    try {
      await axios.delete(`/api/students/${student.id}`);
      await load();
      messageApi.success('学生已删除');
    } catch {
      messageApi.error('删除失败：当前账号可能没有删除权限');
    }
  }

  async function previewImport(file: File) {
    const data = new FormData();
    data.append('file', file);
    importGroups.forEach((groupId) => data.append('groupIds', groupId));
    setImporting(true);
    try {
      const response = await axios.post<ImportPreview>('/api/students/import/preview', data);
      setImportPreview(response.data);
    } catch {
      messageApi.error('导入预览失败，请使用规定的 Excel 模板');
    } finally {
      setImporting(false);
    }
  }

  async function confirmImport() {
    if (!importPreview) return;
    setImporting(true);
    try {
      const response = await axios.post<{ importedCount: number; credentials: Credential[] }>(`/api/students/import/${importPreview.draftId}/confirm`);
      const text = ['学号,姓名,初始密码', ...response.data.credentials.map((item) => `${item.studentNumber},${item.studentName},${item.initialPassword}`)].join('\n');
      const url = URL.createObjectURL(new Blob([`\uFEFF${text}`], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = '学生初始密码.csv'; anchor.click(); URL.revokeObjectURL(url);
      setImportModalOpen(false); setImportPreview(undefined); await load();
      messageApi.success(`已导入 ${response.data.importedCount} 名学生`);
    } catch {
      messageApi.error('确认导入失败，预览可能已失效');
    } finally {
      setImporting(false);
    }
  }

  async function downloadTemplate() {
    try {
      const response = await axios.get('/api/students/import/template', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = '学生导入模板.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      messageApi.error('模板下载失败');
    }
  }

  function exportStudents() {
    const selected = selectedRowKeys.length > 0
      ? visibleStudents.filter((s) => selectedRowKeys.includes(s.id))
      : visibleStudents;
    if (selected.length === 0) {
      messageApi.warning('没有可导出的学生数据');
      return;
    }
    const header = '学号,姓名,邮箱,组别,初始密码';
    const rows = selected.map((s) => [
      s.studentNumber,
      s.studentName,
      s.email ?? '',
      s.groupNames.join(' / '),
      s.initialPassword ?? ''
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = `﻿${header}\n${rows.join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = selectedRowKeys.length > 0 ? `学生信息（已选${selected.length}人）.csv` : `学生信息（${currentGroup?.name ?? '全部'}）.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    messageApi.success(`已导出 ${selected.length} 名学生信息`);
  }

  const columns: ColumnsType<Student> = [
    { title: '学号', dataIndex: 'studentNumber', width: 150 },
    { title: '姓名', dataIndex: 'studentName', width: 130 },
    { title: '初始密码', dataIndex: 'initialPassword', width: 140, render: (password: string | null) => password || <Text type="secondary">已设置</Text> },
    { title: '邮箱', dataIndex: 'email', render: (email) => email || <Text type="secondary">-</Text> },
    { title: '组别', dataIndex: 'groupNames', render: (names: string[]) => <Space size={[4, 4]} wrap>{names.map((name) => <Tag key={name}>{name}</Tag>)}</Space> },
    { title: '操作', width: 140, render: (_, student) => <Space size={0}><Button type="link" onClick={() => openStudent(student)}>编辑</Button><Popconfirm title="确认删除该学生？" onConfirm={() => void deleteStudent(student)}><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> }
  ];

  return (
    <div className="student-management">
      {contextHolder}
      <section className="page-heading student-management-heading">
        <div><Tag color="blue">教学管理</Tag><Title level={2}>学生管理</Title><Paragraph type="secondary">共享学生库和自定义组别可直接用于课程成员选择。</Paragraph></div>
        <Space><Button icon={<DownloadOutlined />} onClick={() => void downloadTemplate()}>下载模板</Button><Button icon={<UploadOutlined />} onClick={() => { setImportPreview(undefined); setImportModalOpen(true); }}>导入 Excel</Button><Button icon={<ExportOutlined />} onClick={() => void exportStudents()}>{selectedRowKeys.length > 0 ? `导出已选（${selectedRowKeys.length}）` : '导出全部'}</Button><Button icon={<PlusOutlined />} onClick={() => setGroupModalOpen(true)}>新建组别</Button><Button type="primary" icon={<UserAddOutlined />} onClick={() => openStudent()}>新增学生</Button></Space>
      </section>
      <div className="student-management-layout">
        <aside className="student-group-rail">
          <Button block type={!activeGroup ? 'primary' : 'text'} onClick={() => setActiveGroup(undefined)}>全部学生 <Text type="secondary">{students.length}</Text></Button>
          {groups.map((group) => <div className="student-group-item" key={group.id}>
            <Button block type={activeGroup === group.id ? 'primary' : 'text'} onClick={() => setActiveGroup(group.id)}>{group.name} <Text type="secondary">{group.studentCount}</Text></Button>
            <Button type="text" size="small" icon={<EditOutlined />} aria-label={`编辑 ${group.name}`} onClick={() => openGroup(group)} />
            <Popconfirm title={`确定删除组别“${group.name}”？`} onConfirm={() => void deleteGroup(group)}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`删除 ${group.name}`} />
            </Popconfirm>
          </div>)}
        </aside>
        <Card className="student-management-card">
          <div className="student-management-toolbar"><Title level={4}>{currentGroup?.name ?? '全部学生'}</Title><Input className="student-search" prefix={<SearchOutlined />} placeholder="搜索姓名、学号或邮箱" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></div>
          <Table rowKey="id" columns={columns} dataSource={visibleStudents} scroll={{ x: 700 }} pagination={{ pageSize: 8, showSizeChanger: false }}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys, preserveSelectedRowKeys: true }}
          />
        </Card>
      </div>
      <Modal title={editing ? '编辑学生' : '新增学生'} open={studentModalOpen} onCancel={() => setStudentModalOpen(false)} onOk={() => void saveStudent()}>
        <Form form={studentForm} layout="vertical"><Form.Item name="studentNumber" label="学号" rules={[{ required: true }]}><Input disabled={Boolean(editing)} /></Form.Item><Form.Item name="studentName" label="姓名" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="email" label="邮箱"><Input /></Form.Item><Form.Item name="groupIds" label="学生组别"><Select mode="multiple" options={groups.map((group) => ({ value: group.id, label: group.name }))} /></Form.Item></Form>
      </Modal>
      <Modal title={editingGroup ? '编辑组别' : '新建组别'} open={groupModalOpen} onCancel={() => { setGroupModalOpen(false); setEditingGroup(undefined); }} onOk={() => void createGroup()}><Form form={groupForm} layout="vertical"><Form.Item name="name" label="组别名称" rules={[{ required: true }]}><Input /></Form.Item></Form></Modal>
      <Modal title="Excel 批量导入" open={importModalOpen} confirmLoading={importing} onCancel={() => setImportModalOpen(false)} onOk={() => void confirmImport()} okButtonProps={{ disabled: !importPreview || importPreview.validCount === 0 }} okText="确认导入">
        <Space direction="vertical" className="content-stack">
          <Select mode="multiple" allowClear placeholder="导入后归入的学生组别（可选）" value={importGroups} onChange={setImportGroups} options={groups.map((group) => ({ value: group.id, label: group.name }))} />
          <Upload accept=".xlsx" maxCount={1} beforeUpload={(file) => { void previewImport(file); return false; }} showUploadList={false}><Button loading={importing} icon={<UploadOutlined />}>选择 Excel 文件</Button></Upload>
          {importPreview && <><Text>有效 {importPreview.validCount} 行，跳过 {importPreview.invalidCount} 行。</Text><Table size="small" rowKey="rowNumber" pagination={{ pageSize: 5 }} dataSource={importPreview.rows} columns={[{ title: '行', dataIndex: 'rowNumber' }, { title: '学号', dataIndex: 'studentNumber' }, { title: '姓名', dataIndex: 'studentName' }, { title: '结果', render: (_, row: ImportRow) => row.valid ? <Tag color="green">可导入</Tag> : <Tag color="red">{row.issue}</Tag> }]} /></>}
        </Space>
      </Modal>
    </div>
  );
}
