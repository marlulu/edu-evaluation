import { CopyOutlined, DownloadOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AuditLog,
  type AuditQuery,
  type BackupInput,
  type BackupRecord,
  type RubricDimension,
  type RubricTemplate,
  type RubricTemplateInput,
  type SystemUser,
  type SystemUserInput,
  type TemplateStatus,
  copyRubricTemplate,
  createBackup,
  disableSystemUser,
  exportAuditLogs,
  fetchAuditLogs,
  fetchSystemAdminData,
  getApiErrorMessage,
  restoreBackup,
  saveRubricTemplate,
  saveSystemUser
} from './api';

const { Paragraph, Text, Title } = Typography;

const roleOptions = [
  { label: '管理员', value: 'ADMIN' },
  { label: '教师', value: 'TEACHER' },
  { label: '助教', value: 'ASSISTANT' },
  { label: '学生', value: 'STUDENT' }
];

const permissionOptions = [
  { label: '用户管理', value: 'USER_MANAGE' },
  { label: '权限调整', value: 'PERMISSION_GRANT' },
  { label: '评价模板管理', value: 'RUBRIC_MANAGE' },
  { label: '审计日志查看', value: 'AUDIT_VIEW' },
  { label: '数据导出', value: 'DATA_EXPORT' },
  { label: '备份恢复', value: 'BACKUP_RESTORE' },
  { label: '结果复核', value: 'RESULT_REVIEW' }
];

const templateStatusOptions: { label: string; value: TemplateStatus; color: string }[] = [
  { label: '草稿', value: 'DRAFT', color: 'default' },
  { label: '启用', value: 'ACTIVE', color: 'green' },
  { label: '停用', value: 'DISABLED', color: 'default' }
];

type UserFormValues = SystemUserInput & { dataScopesText?: string };
type TemplateFormValues = Omit<RubricTemplateInput, 'dimensions'> & {
  dimensionOneName: string;
  dimensionOneWeight: number;
  dimensionOneRule: string;
  dimensionTwoName: string;
  dimensionTwoWeight: number;
  dimensionTwoRule: string;
  dimensionThreeName: string;
  dimensionThreeWeight: number;
  dimensionThreeRule: string;
  dimensionFourName: string;
  dimensionFourWeight: number;
  dimensionFourRule: string;
};

export function SystemAdmin() {
  const [apiMessage, contextHolder] = message.useMessage();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [templates, setTemplates] = useState<RubricTemplate[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | undefined>();
  const [editingTemplate, setEditingTemplate] = useState<RubricTemplate | undefined>();
  const [auditQuery, setAuditQuery] = useState<AuditQuery>({});
  const [userForm] = Form.useForm<UserFormValues>();
  const [templateForm] = Form.useForm<TemplateFormValues>();
  const [backupForm] = Form.useForm<BackupInput>();
  const [auditForm] = Form.useForm<AuditQuery>();
  const statusByValue = useMemo(() => new Map(templateStatusOptions.map((status) => [status.value, status])), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSystemAdminData();
      setUsers(data.users);
      setTemplates(data.templates);
      setAuditLogs(data.auditLogs);
      setBackups(data.backups);
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [apiMessage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openUserModal(user?: SystemUser) {
    setEditingUser(user);
    userForm.setFieldsValue(
      user
        ? { ...user, dataScopesText: user.dataScopes.join('\n') }
        : {
            username: '',
            displayName: '',
            email: '',
            roles: ['STUDENT'],
            permissions: [],
            dataScopesText: '人工智能概论',
            status: 'ACTIVE'
          }
    );
    setUserModalOpen(true);
  }

  async function submitUser() {
    try {
      const values = await userForm.validateFields();
      const input: SystemUserInput = {
        username: values.username,
        displayName: values.displayName,
        email: values.email,
        roles: values.roles,
        permissions: values.permissions,
        dataScopes: splitLines(values.dataScopesText),
        status: values.status
      };
      await saveSystemUser(input, editingUser?.id);
      setUserModalOpen(false);
      await loadData();
      apiMessage.success('用户权限已保存');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  function openTemplateModal(template?: RubricTemplate) {
    setEditingTemplate(template);
    const dimensions = template?.dimensions ?? [
      { name: 'AI 概念准确性', weight: 25, scoringRule: '概念准确，术语清晰。' },
      { name: '算法理解', weight: 25, scoringRule: '理解算法思想、场景和局限。' },
      { name: '案例分析', weight: 20, scoringRule: '能结合案例说明问题和结果。' },
      { name: '结构表达', weight: 30, scoringRule: '结构完整，表达清晰，引用规范。' }
    ];
    templateForm.setFieldsValue({
      name: template?.name ?? '',
      description: template?.description ?? '',
      courseScope: template?.courseScope ?? '人工智能概论',
      status: template?.status ?? 'DRAFT',
      dimensionOneName: dimensions[0]?.name,
      dimensionOneWeight: dimensions[0]?.weight,
      dimensionOneRule: dimensions[0]?.scoringRule,
      dimensionTwoName: dimensions[1]?.name,
      dimensionTwoWeight: dimensions[1]?.weight,
      dimensionTwoRule: dimensions[1]?.scoringRule,
      dimensionThreeName: dimensions[2]?.name,
      dimensionThreeWeight: dimensions[2]?.weight,
      dimensionThreeRule: dimensions[2]?.scoringRule,
      dimensionFourName: dimensions[3]?.name,
      dimensionFourWeight: dimensions[3]?.weight,
      dimensionFourRule: dimensions[3]?.scoringRule
    });
    setTemplateModalOpen(true);
  }

  async function submitTemplate() {
    try {
      const values = await templateForm.validateFields();
      const dimensions: RubricDimension[] = [
        { name: values.dimensionOneName, weight: values.dimensionOneWeight, scoringRule: values.dimensionOneRule },
        { name: values.dimensionTwoName, weight: values.dimensionTwoWeight, scoringRule: values.dimensionTwoRule },
        { name: values.dimensionThreeName, weight: values.dimensionThreeWeight, scoringRule: values.dimensionThreeRule },
        { name: values.dimensionFourName, weight: values.dimensionFourWeight, scoringRule: values.dimensionFourRule }
      ];
      await saveRubricTemplate(
        {
          name: values.name,
          description: values.description,
          courseScope: values.courseScope,
          status: values.status,
          dimensions
        },
        editingTemplate?.id
      );
      setTemplateModalOpen(false);
      await loadData();
      apiMessage.success('评价模板已保存并生成版本');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function searchAuditLogs(values: AuditQuery) {
    try {
      setAuditQuery(values);
      setAuditLogs(await fetchAuditLogs(values));
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function submitBackup(values: BackupInput) {
    try {
      await createBackup(values);
      backupForm.resetFields();
      await loadData();
      apiMessage.success('备份记录已创建');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  async function restoreBackupRecord(record: BackupRecord) {
    try {
      await restoreBackup(record.id, record.operator || 'system');
      await loadData();
      apiMessage.success('恢复操作已记录');
    } catch (error) {
      apiMessage.error(getApiErrorMessage(error));
    }
  }

  return (
    <section>
      {contextHolder}
      <Card>
        <Space direction="vertical" size={20} className="content-stack">
          <Space align="start" className="toolbar-row">
            <div>
              <Title level={2}>系统管理与配置模块</Title>
              <Paragraph type="secondary">
                管理角色权限、评价指标体系、操作审计和备份恢复。当前为非 AI 管理能力 MVP，所有关键配置操作都会写入审计日志。
              </Paragraph>
            </div>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
              刷新
            </Button>
          </Space>
          <Tabs
            items={[
              {
                key: 'users',
                label: '用户权限',
                children: (
                  <Space direction="vertical" size={16} className="content-stack">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openUserModal()}>
                      新增用户
                    </Button>
                    <Table
                      rowKey="id"
                      loading={loading}
                      dataSource={users}
                      columns={[
                        { title: '用户名', dataIndex: 'username' },
                        { title: '显示名称', dataIndex: 'displayName' },
                        { title: '邮箱', dataIndex: 'email' },
                        { title: '角色', dataIndex: 'roles', render: (roles: string[]) => roles.map((role) => <Tag key={role}>{role}</Tag>) },
                        { title: '权限', dataIndex: 'permissions', render: (permissions: string[]) => permissions.map((permission) => <Tag color="blue" key={permission}>{permission}</Tag>) },
                        { title: '数据范围', dataIndex: 'dataScopes', render: (scopes: string[]) => scopes.join(' / ') },
                        { title: '状态', dataIndex: 'status', render: (status: string) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag> },
                        {
                          title: '操作',
                          render: (_: unknown, record: SystemUser) => (
                            <Space>
                              <Button icon={<EditOutlined />} onClick={() => openUserModal(record)} />
                              <Popconfirm title="确认停用该用户？" onConfirm={() => void disableSystemUser(record.id).then(loadData)}>
                                <Button danger>停用</Button>
                              </Popconfirm>
                            </Space>
                          )
                        }
                      ]}
                    />
                  </Space>
                )
              },
              {
                key: 'templates',
                label: '评价指标体系',
                children: (
                  <Space direction="vertical" size={16} className="content-stack">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openTemplateModal()}>
                      新增模板
                    </Button>
                    <Table
                      rowKey="id"
                      dataSource={templates}
                      expandable={{
                        expandedRowRender: (template) => (
                          <Space direction="vertical" className="content-stack">
                            <Table
                              rowKey="name"
                              size="small"
                              pagination={false}
                              dataSource={template.dimensions}
                              columns={[
                                { title: '评价维度', dataIndex: 'name' },
                                { title: '权重', dataIndex: 'weight', render: (weight: number) => `${weight}%` },
                                { title: '评分细则', dataIndex: 'scoringRule' }
                              ]}
                            />
                            <Table
                              rowKey="id"
                              size="small"
                              pagination={false}
                              dataSource={template.history}
                              columns={[
                                { title: '版本', dataIndex: 'version' },
                                { title: '名称', dataIndex: 'name' },
                                { title: '状态', dataIndex: 'status' },
                                { title: '创建时间', dataIndex: 'createdAt' }
                              ]}
                            />
                          </Space>
                        )
                      }}
                      columns={[
                        { title: '模板名称', dataIndex: 'name' },
                        { title: '适用课程', dataIndex: 'courseScope' },
                        { title: '版本', dataIndex: 'currentVersion' },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          render: (status: TemplateStatus) => {
                            const option = statusByValue.get(status);
                            return <Tag color={option?.color}>{option?.label ?? status}</Tag>;
                          }
                        },
                        {
                          title: '操作',
                          render: (_: unknown, record: RubricTemplate) => (
                            <Space>
                              <Button icon={<EditOutlined />} onClick={() => openTemplateModal(record)} />
                              <Button icon={<CopyOutlined />} onClick={() => void copyRubricTemplate(record.id).then(loadData)}>
                                复制
                              </Button>
                            </Space>
                          )
                        }
                      ]}
                    />
                  </Space>
                )
              },
              {
                key: 'audit',
                label: '日志与审计',
                children: (
                  <Space direction="vertical" size={16} className="content-stack">
                    <Form form={auditForm} layout="inline" onFinish={(values) => void searchAuditLogs(values)}>
                      <Form.Item name="actor" label="操作人">
                        <Input allowClear />
                      </Form.Item>
                      <Form.Item name="action" label="操作类型">
                        <Input allowClear />
                      </Form.Item>
                      <Form.Item name="objectType" label="对象">
                        <Input allowClear />
                      </Form.Item>
                      <Form.Item name="result" label="结果">
                        <Input allowClear />
                      </Form.Item>
                      <Button htmlType="submit" type="primary">
                        检索
                      </Button>
                      <Button icon={<DownloadOutlined />} onClick={() => void exportAuditLogs(auditQuery)}>
                        导出
                      </Button>
                    </Form>
                    <Table
                      rowKey="id"
                      dataSource={auditLogs}
                      columns={[
                        { title: '操作人', dataIndex: 'actor' },
                        { title: '时间', dataIndex: 'operatedAt' },
                        { title: '类型', dataIndex: 'action' },
                        { title: '对象', dataIndex: 'objectType' },
                        { title: '对象 ID', dataIndex: 'objectId' },
                        { title: '结果', dataIndex: 'result', render: (result: string) => <Tag color={result === 'SUCCESS' ? 'green' : 'red'}>{result}</Tag> },
                        { title: '详情', dataIndex: 'detail' }
                      ]}
                    />
                  </Space>
                )
              },
              {
                key: 'backup',
                label: '备份与恢复',
                children: (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} xl={8}>
                      <Card title="创建备份">
                        <Form form={backupForm} layout="vertical" onFinish={(values) => void submitBackup(values)}>
                          <Form.Item name="name" label="备份名称" rules={[{ required: true }]}>
                            <Input />
                          </Form.Item>
                          <Form.Item name="scope" label="备份范围">
                            <Input.TextArea rows={3} placeholder="作业文件、评分结果、评价模板、日志数据" />
                          </Form.Item>
                          <Form.Item name="operator" label="操作人">
                            <Input placeholder="admin" />
                          </Form.Item>
                          <Button type="primary" icon={<SafetyCertificateOutlined />} htmlType="submit">
                            创建备份记录
                          </Button>
                        </Form>
                      </Card>
                    </Col>
                    <Col xs={24} xl={16}>
                      <Table
                        rowKey="id"
                        dataSource={backups}
                        columns={[
                          { title: '备份名称', dataIndex: 'name' },
                          { title: '范围', dataIndex: 'scope' },
                          { title: '状态', dataIndex: 'status' },
                          { title: '操作人', dataIndex: 'operator' },
                          { title: '位置', dataIndex: 'storagePath' },
                          { title: '创建时间', dataIndex: 'createdAt' },
                          { title: '恢复时间', dataIndex: 'restoredAt', render: (value?: string) => value || '未恢复' },
                          {
                            title: '操作',
                            render: (_: unknown, record: BackupRecord) => (
                              <Popconfirm title="确认执行恢复并记录审计？" onConfirm={() => void restoreBackupRecord(record)}>
                                <Button>恢复</Button>
                              </Popconfirm>
                            )
                          }
                        ]}
                      />
                    </Col>
                  </Row>
                )
              }
            ]}
          />
        </Space>
      </Card>

      <Modal title={editingUser ? '编辑用户权限' : '新增用户'} open={userModalOpen} onCancel={() => setUserModalOpen(false)} onOk={() => void submitUser()} width={720}>
        <Form form={userForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="roles" label="角色" rules={[{ required: true }]}>
            <Select mode="multiple" options={roleOptions} />
          </Form.Item>
          <Form.Item name="permissions" label="功能权限">
            <Select mode="multiple" options={permissionOptions} />
          </Form.Item>
          <Form.Item name="dataScopesText" label="数据权限范围">
            <Input.TextArea rows={3} placeholder="每行一个课程、班级或 ALL" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { label: '启用', value: 'ACTIVE' },
                { label: '停用', value: 'DISABLED' }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editingTemplate ? '编辑评价模板' : '新增评价模板'} open={templateModalOpen} onCancel={() => setTemplateModalOpen(false)} onOk={() => void submitTemplate()} width={900}>
        <Form form={templateForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="courseScope" label="适用课程范围">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="模板说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="status" label="模板状态">
            <Select options={templateStatusOptions.map((status) => ({ label: status.label, value: status.value }))} />
          </Form.Item>
          {[1, 2, 3, 4].map((index) => (
            <Card size="small" title={`评价维度 ${index}`} key={index} className="form-subcard">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name={`dimension${numberToWord(index)}Name`} label="维度名称" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name={`dimension${numberToWord(index)}Weight`} label="权重" rules={[{ required: true }]}>
                    <InputNumber min={0} max={100} addonAfter="%" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name={`dimension${numberToWord(index)}Rule`} label="评分细则" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ))}
          <Text type="secondary">保存模板会生成新版本。评分结果后续应保存当时使用的模板 ID 和版本号。</Text>
        </Form>
      </Modal>
    </section>
  );
}

function splitLines(value?: string) {
  return (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function numberToWord(index: number) {
  return ['One', 'Two', 'Three', 'Four'][index - 1];
}
