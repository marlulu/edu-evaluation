import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { useMemo, useState } from 'react';

const { Paragraph, Text, Title } = Typography;

type Group = { id: string; name: string; color: string };
type Student = { id: string; number: string; name: string; email?: string; groups: string[] };
type StudentForm = { number: string; name: string; email?: string; groups?: string[] };

const initialGroups: Group[] = [
  { id: 'project', name: '项目 A 组', color: 'blue' },
  { id: 'focus', name: '重点辅导', color: 'orange' },
  { id: 'defense', name: '答辩组', color: 'purple' }
];

const initialStudents: Student[] = [
  { id: 's-1', number: '20240001', name: '林悦', email: 'linyue@example.edu', groups: ['project', 'focus'] },
  { id: 's-2', number: '20240002', name: '周晨', email: 'zhouchen@example.edu', groups: ['project'] },
  { id: 's-3', number: '20240003', name: '陈思远', groups: ['defense'] },
  { id: 's-4', number: '20240004', name: '王宁', groups: [] }
];

export function StudentManagement() {
  const [messageApi, contextHolder] = message.useMessage();
  const [groups, setGroups] = useState(initialGroups);
  const [students, setStudents] = useState(initialStudents);
  const [activeGroup, setActiveGroup] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | undefined>();
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [studentForm] = Form.useForm<StudentForm>();
  const [groupForm] = Form.useForm<{ name: string }>();

  const visibleStudents = useMemo(
    () =>
      students.filter((student) => {
        const matchesGroup = activeGroup === 'all' || student.groups.includes(activeGroup);
        const term = keyword.trim().toLowerCase();
        return matchesGroup && (!term || `${student.name}${student.number}${student.email ?? ''}`.toLowerCase().includes(term));
      }),
    [activeGroup, keyword, students]
  );

  function openStudentModal(student?: Student) {
    setEditingStudent(student);
    studentForm.setFieldsValue(student ? { number: student.number, name: student.name, email: student.email, groups: student.groups } : { number: '', name: '', groups: [] });
    setStudentModalOpen(true);
  }

  function saveStudent() {
    void studentForm.validateFields().then((values) => {
      if (students.some((student) => student.number === values.number && student.id !== editingStudent?.id)) {
        messageApi.error('学号已存在');
        return;
      }
      const next: Student = {
        id: editingStudent?.id ?? crypto.randomUUID(),
        number: values.number,
        name: values.name,
        email: values.email,
        groups: values.groups ?? []
      };
      setStudents((current) => editingStudent ? current.map((student) => student.id === next.id ? next : student) : [next, ...current]);
      setStudentModalOpen(false);
      messageApi.success(editingStudent ? '学生信息已更新' : '学生已新增');
    });
  }

  function saveGroup() {
    void groupForm.validateFields().then((values) => {
      if (groups.some((group) => group.name === values.name)) {
        messageApi.error('组别名称已存在');
        return;
      }
      setGroups((current) => [...current, { id: crypto.randomUUID(), name: values.name, color: 'cyan' }]);
      setGroupModalOpen(false);
      messageApi.success('组别已创建');
    });
  }

  function deleteGroup(group: Group) {
    setGroups((current) => current.filter((item) => item.id !== group.id));
    setStudents((current) => current.map((student) => ({ ...student, groups: student.groups.filter((id) => id !== group.id) })));
    setActiveGroup('all');
    messageApi.success(`已删除组别“${group.name}”`);
  }

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF学号,姓名,邮箱,备注\n20240001,张三,zhangsan@example.edu,'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '学生导入模板.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const columns: TableProps<Student>['columns'] = [
    { title: '学号', dataIndex: 'number', width: 130 },
    { title: '姓名', dataIndex: 'name', width: 120 },
    { title: '邮箱', dataIndex: 'email', render: (value?: string) => value || <Text type="secondary">-</Text> },
    {
      title: '组别',
      render: (_, student) => <Space size={[4, 4]} wrap>{student.groups.map((id) => {
        const group = groups.find((item) => item.id === id);
        return group ? <Tag color={group.color} key={id}>{group.name}</Tag> : null;
      })}</Space>
    },
    {
      title: '操作',
      width: 120,
      render: (_, student) => <Space size={0}>
        <Button type="text" icon={<EditOutlined />} onClick={() => openStudentModal(student)} />
        <Popconfirm title={`删除学生“${student.name}”？`} onConfirm={() => setStudents((current) => current.filter((item) => item.id !== student.id))}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    }
  ];

  return (
    <div className="student-management">
      {contextHolder}
      <section className="page-heading student-management-heading">
        <div>
          <Tag color="blue">教学管理</Tag>
          <Title level={2}>学生管理</Title>
          <Paragraph type="secondary">按自定义组别维护学生名单，支持手动新增与导入前分组。</Paragraph>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>下载模板</Button>
          <Button icon={<UploadOutlined />} onClick={() => messageApi.info('Excel 导入预览将在下一步接入')}>导入 Excel</Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => openStudentModal()}>新增学生</Button>
        </Space>
      </section>
      <div className="student-management-layout">
        <aside className="student-group-rail">
          <Button type="primary" block icon={<PlusOutlined />} onClick={() => { groupForm.resetFields(); setGroupModalOpen(true); }}>新建组别</Button>
          <button type="button" className={activeGroup === 'all' ? 'group-link active' : 'group-link'} onClick={() => setActiveGroup('all')}>
            <span>全部学生</span><Text type="secondary">{students.length}</Text>
          </button>
          <Text type="secondary" className="group-rail-label">自定义组别</Text>
          {groups.map((group) => (
            <div key={group.id} className={activeGroup === group.id ? 'group-link active' : 'group-link'}>
              <button type="button" onClick={() => setActiveGroup(group.id)}><Tag color={group.color} />{group.name}</button>
              <Popconfirm title={`删除组别“${group.name}”？学生资料不会被删除。`} onConfirm={() => deleteGroup(group)}>
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          ))}
        </aside>
        <Card className="student-management-card">
          <div className="student-management-toolbar">
            <div><Title level={4}>{activeGroup === 'all' ? '全部学生' : groups.find((group) => group.id === activeGroup)?.name}</Title><Text type="secondary">共 {visibleStudents.length} 名学生</Text></div>
            <Input className="student-search" prefix={<SearchOutlined />} placeholder="搜索姓名、学号或邮箱" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </div>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={visibleStudents}
            scroll={{ x: 700 }}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          />
        </Card>
      </div>
      <Modal title={editingStudent ? '编辑学生' : '新增学生'} open={studentModalOpen} onCancel={() => setStudentModalOpen(false)} onOk={saveStudent}>
        <Form form={studentForm} layout="vertical">
          <Form.Item name="number" label="学号" rules={[{ required: true, message: '请输入学号' }]}><Input /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="groups" label="自定义组别"><Select mode="multiple" options={groups.map((group) => ({ value: group.id, label: group.name }))} /></Form.Item>
        </Form>
      </Modal>
      <Modal title="新建组别" open={groupModalOpen} onCancel={() => setGroupModalOpen(false)} onOk={saveGroup}>
        <Form form={groupForm} layout="vertical"><Form.Item name="name" label="组别名称" rules={[{ required: true, message: '请输入组别名称' }]}><Input /></Form.Item></Form>
      </Modal>
    </div>
  );
}
