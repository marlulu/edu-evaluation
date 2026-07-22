import { ApiOutlined, DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlayCircleOutlined, PlusOutlined, StarFilled } from '@ant-design/icons';
import { Button, Card, Checkbox, Col, Empty, Form, Input, Modal, Popconfirm, Row, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import type { ModelProfile, ModelProfileInput } from './api';
import { activateModelProfile, createModelProfile, deleteModelProfile, fetchModelProfiles, testModelProfile, updateModelProfile } from './api';

const { Paragraph, Title, Text } = Typography;
type FormValues = ModelProfileInput;
const officialPreset = { providerName: 'OpenAI', website: 'https://platform.openai.com', apiKeyHelpUrl: 'https://platform.openai.com/api-keys', baseUrl: 'https://api.openai.com/v1' };

export function SystemConfig() {
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ModelProfile>();
  const [open, setOpen] = useState(false);
  const [testingId, setTestingId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const load = useCallback(async () => { setLoading(true); try { setProfiles(await fetchModelProfiles()); } catch { messageApi.error('模型配置加载失败'); } finally { setLoading(false); } }, [messageApi]);
  useEffect(() => { void load(); }, [load]);
  function showCreate() { setEditing(undefined); setShowKey(false); form.setFieldsValue({ ...officialPreset, modelName: '', apiKey: '' }); setOpen(true); }
  function showEdit(profile: ModelProfile) { setEditing(profile); setShowKey(false); form.setFieldsValue({ providerName: profile.providerName, note: profile.note ?? undefined, website: profile.website ?? undefined, apiKeyHelpUrl: profile.apiKeyHelpUrl ?? undefined, baseUrl: profile.baseUrl, modelName: profile.modelName, apiKey: '' }); setOpen(true); }
  async function save() { const values = await form.validateFields(); if (editing && !values.apiKey) { messageApi.error('修改配置时请重新输入 API Key'); return; } setSaving(true); try { if (editing) await updateModelProfile(editing.id, values); else await createModelProfile(values); messageApi.success('模型档案已保存'); setOpen(false); void load(); } catch { messageApi.error('保存失败'); } finally { setSaving(false); } }
  async function activate(id: string) { try { await activateModelProfile(id); messageApi.success('默认模型已切换'); void load(); } catch { messageApi.error('切换失败'); } }
  async function test(profile: ModelProfile) { setTestingId(profile.id); try { const result = await testModelProfile(profile.id); Modal.info({ title: result.success ? 'SDK 测试成功' : 'SDK 测试失败', content: <Space direction="vertical"><Text>{result.message}</Text><Text type="secondary">请求模型：{result.requestedModel ?? profile.modelName}</Text><Text type="secondary">请求地址：{result.requestedBaseUrl ?? profile.baseUrl}</Text><Text type="secondary">耗时：{result.latencyMs}ms</Text></Space> }); void load(); } catch { messageApi.error('连接测试失败'); } finally { setTestingId(undefined); } }
  const columns: ColumnsType<ModelProfile> = [
    { title: '供应商 / 模型', render: (_, p) => <Space direction="vertical" size={0}><Space>{p.active && <Tag color="gold" icon={<StarFilled />}>默认</Tag>}<Text strong>{p.providerName}</Text></Space><Text type="secondary">{p.modelName}</Text></Space> },
    { title: '请求地址', dataIndex: 'baseUrl', ellipsis: true },
    { title: 'API Key', dataIndex: 'maskedApiKey', width: 150 },
    { title: '状态', width: 110, render: (_, p) => p.lastTestSuccess === null ? <Tag>未测试</Tag> : <Tag color={p.lastTestSuccess ? 'green' : 'red'}>{p.lastTestSuccess ? '可用' : '失败'}</Tag> },
    { title: '操作', width: 270, render: (_, p) => <Space size={4}><Button type={p.active ? 'default' : 'primary'} disabled={p.active} onClick={() => void activate(p.id)}>设为默认</Button><Button icon={<PlayCircleOutlined />} loading={testingId === p.id} onClick={() => void test(p)}>测试</Button><Button type="text" icon={<EditOutlined />} aria-label="编辑模型" onClick={() => showEdit(p)} /><Popconfirm title="删除此模型档案？" disabled={p.active} onConfirm={() => void deleteModelProfile(p.id).then(load)}><Button type="text" danger disabled={p.active} icon={<DeleteOutlined />} aria-label="删除模型" /></Popconfirm></Space> }
  ];
  return <Space direction="vertical" size={18} className="content-stack">{contextHolder}<section className="page-heading"><div><Tag color="blue">系统设置</Tag><Title level={2}>系统配置</Title><Paragraph type="secondary">管理模型档案，以及教师和助教的模块权限。</Paragraph></div></section><Tabs items={[{ key: 'models', label: '模型配置', children: <><div style={{ marginBottom: 16 }}><Button type="primary" icon={<PlusOutlined />} onClick={showCreate}>新增模型</Button></div><Card><Table rowKey="id" loading={loading} columns={columns} dataSource={profiles} pagination={false} locale={{ emptyText: <Empty description="暂无模型档案" /> }} scroll={{ x: 900 }} /></Card></> }, { key: 'permissions', label: '教师权限', children: <PermissionConfig /> }]} /><Modal title={editing ? '编辑模型档案' : '新增模型档案'} open={open} onCancel={() => setOpen(false)} onOk={() => void save()} confirmLoading={saving} destroyOnClose><Form form={form} layout="vertical"><Row gutter={16}><Col span={12}><Form.Item name="providerName" label="供应商名称" rules={[{ required: true }]}><Input placeholder="例如：OpenAI、DeepSeek" /></Form.Item></Col><Col span={12}><Form.Item name="modelName" label="模型名称" rules={[{ required: true }]}><Input placeholder="例如：gpt-4.1" /></Form.Item></Col></Row><Form.Item name="note" label="备注"><Input placeholder="例如：公司专用账号" /></Form.Item><Form.Item name="website" label="官网链接"><Input /></Form.Item><Form.Item name="apiKey" label="API Key" rules={[{ required: !editing }]}><Input.Password visibilityToggle={{ visible: showKey, onVisibleChange: setShowKey }} iconRender={(visible) => visible ? <EyeOutlined /> : <EyeInvisibleOutlined />} placeholder={editing ? '重新输入以更新密钥' : '输入 API Key'} /></Form.Item><Form.Item name="apiKeyHelpUrl" label="获取 API Key 链接"><Input /></Form.Item><Form.Item name="baseUrl" label="请求地址" rules={[{ required: true }]}><Input prefix={<ApiOutlined />} /></Form.Item></Form></Modal></Space>;
}

type PermissionAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE';
type TeacherPermission = { moduleName: string; actions: PermissionAction[] };
type Teacher = { id: string; username: string; displayName: string; role: 'TEACHER' | 'ASSISTANT'; permissions: TeacherPermission[] };
const moduleLabels: Record<string, string> = { COURSE: '课程管理', STUDENT: '学生管理', TASK: '任务管理' };
const actionLabels: Record<PermissionAction, string> = { VIEW: '查看', CREATE: '创建', EDIT: '编辑', DELETE: '删除' };
function PermissionConfig() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string>();
  const [messageApi, contextHolder] = message.useMessage();
  const load = useCallback(async () => { setLoading(true); try { setTeachers((await axios.get<Teacher[]>('/api/auth/admin/module-permissions')).data); } catch { messageApi.error('权限配置加载失败'); } finally { setLoading(false); } }, [messageApi]);
  useEffect(() => { void load(); }, [load]);
  async function save(teacher: Teacher, permission: TeacherPermission, actions: PermissionAction[]) { const key = `${teacher.id}-${permission.moduleName}`; setSavingKey(key); try { const response = await axios.put<Teacher>(`/api/auth/admin/module-permissions/${teacher.id}`, { moduleName: permission.moduleName, actions }); setTeachers((current) => current.map((item) => item.id === teacher.id ? response.data : item)); messageApi.success('权限已更新'); } catch { messageApi.error('权限更新失败'); } finally { setSavingKey(undefined); } }
  const columns: ColumnsType<Teacher> = [{ title: '账号', dataIndex: 'username', width: 160 }, { title: '姓名', dataIndex: 'displayName', width: 150 }, { title: '角色', dataIndex: 'role', width: 110, render: (role: Teacher['role']) => <Tag color={role === 'TEACHER' ? 'blue' : 'purple'}>{role === 'TEACHER' ? '教师' : '助教'}</Tag> }, { title: '模块操作权限', render: (_, teacher) => <Space direction="vertical" size={8}>{teacher.permissions.map((permission) => { const key = `${teacher.id}-${permission.moduleName}`; return <Space key={key} wrap><strong>{moduleLabels[permission.moduleName]}</strong><Checkbox.Group<PermissionAction> options={(Object.keys(actionLabels) as PermissionAction[]).map((value) => ({ value, label: actionLabels[value] }))} value={permission.actions} onChange={(values) => void save(teacher, permission, values)} />{savingKey === key && <Button size="small" loading />}</Space>; })}</Space> }];
  return <>{contextHolder}<Card><Table rowKey="id" columns={columns} dataSource={teachers} loading={loading} locale={{ emptyText: <Empty description="暂无教师账号" /> }} pagination={false} scroll={{ x: 900 }} /></Card></>;
}
