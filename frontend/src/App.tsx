import { CheckCircleOutlined, CloudServerOutlined, ExperimentOutlined } from '@ant-design/icons';
import { Card, Col, Layout, Row, Space, Tag, Typography } from 'antd';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const serviceCards = [
  {
    title: 'React Frontend',
    description: 'Teacher and student web interface shell.',
    icon: <CheckCircleOutlined />
  },
  {
    title: 'Spring Boot Backend',
    description: 'Business API and orchestration layer.',
    icon: <CloudServerOutlined />
  },
  {
    title: 'Python AI Worker',
    description: 'Future extraction and evaluation service.',
    icon: <ExperimentOutlined />
  }
];

export default function App() {
  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <Title level={4} className="app-title">
          人工智能概论大作业评价系统
        </Title>
        <Tag color="processing">Framework Scaffold</Tag>
      </Header>
      <Content className="app-content">
        <Space direction="vertical" size={24} className="content-stack">
          <section>
            <Title level={2}>系统框架已就绪</Title>
            <Text type="secondary">
              当前版本仅包含前端、后端、AI Worker 与基础设施的应用骨架，业务功能将在后续阶段实现。
            </Text>
          </section>
          <Row gutter={[16, 16]}>
            {serviceCards.map((card) => (
              <Col xs={24} md={8} key={card.title}>
                <Card>
                  <Space direction="vertical" size={12}>
                    <span className="card-icon">{card.icon}</span>
                    <Title level={5}>{card.title}</Title>
                    <Text type="secondary">{card.description}</Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
      </Content>
    </Layout>
  );
}
