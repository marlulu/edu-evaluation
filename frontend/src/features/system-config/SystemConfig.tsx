import { SaveOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Empty, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

const { Paragraph, Title } = Typography;
type Action = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE';
type ModulePermissions = { moduleName: string; actions: Action[] };
type Teacher = { id: string; username: string; displayName: string; role: 'TEACHER' | 'ASSISTANT'; permissions: ModulePermissions[] };
const moduleLabels: Record<string, string> = { COURSE: '课程管理', STUDENT: '学生管理', TASK: '任务管理' };
const actionLabels: Record<Action, string> = { VIEW: '查看', CREATE: '创建', EDIT: '编辑', DELETE: '删除' };

export function SystemConfig() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string>();
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<Teacher[]>('/api/auth/admin/module-permissions');
      setTeachers(response.data);
    } catch {
      messageApi.error('权限配置加载失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);
  useEffect(() => { void load(); }, [load]);

  async function save(teacher: Teacher, permission: ModulePermissions, actions: Action[]) {
    const key = `${teacher.id}-${permission.moduleName}`;
    setSavingKey(key);
    try {
      const response = await axios.put<Teacher>(`/api/auth/admin/module-permissions/${teacher.id}`, {
        moduleName: permission.moduleName,
        actions
      });
      setTeachers((current) => current.map((item) => item.id === teacher.id ? response.data : item));
      messageApi.success('权限已更新');
    } catch {
      messageApi.error('权限更新失败');
    } finally {
      setSavingKey(undefined);
    }
  }

  const columns: ColumnsType<Teacher> = [
    { title: '账号', dataIndex: 'username', width: 160 },
    { title: '姓名', dataIndex: 'displayName', width: 150 },
    { title: '角色', dataIndex: 'role', width: 110, render: (role) => <Tag color={role === 'TEACHER' ? 'blue' : 'purple'}>{role === 'TEACHER' ? '教师' : '助教'}</Tag> },
    {
      title: '模块操作权限',
      dataIndex: 'permissions',
      render: (permissions: ModulePermissions[], teacher) => <Space direction="vertical" size={8}>
        {permissions.map((permission) => {
          const key = `${teacher.id}-${permission.moduleName}`;
          return <Space key={key} wrap><strong>{moduleLabels[permission.moduleName]}</strong>
            <Checkbox.Group<Action> options={(Object.keys(actionLabels) as Action[]).map((value) => ({ value, label: actionLabels[value] }))} value={permission.actions} onChange={(values) => void save(teacher, permission, values)} />
            {savingKey === key && <Button size="small" loading icon={<SaveOutlined />} />}
          </Space>;
        })}
      </Space>
    }
  ];
  return <Space direction="vertical" size={18} className="content-stack">
    {contextHolder}
    <section className="page-heading"><div><Tag color="blue">系统配置</Tag><Title level={2}>教师模块权限</Title><Paragraph type="secondary">控制教师与助教对课程、学生和任务模块的查看、创建、编辑、删除权限。</Paragraph></div></section>
    <Card><Table rowKey="id" columns={columns} dataSource={teachers} loading={loading} locale={{ emptyText: <Empty description="暂无教师账号" /> }} pagination={false} scroll={{ x: 900 }} /></Card>
  </Space>;
}
