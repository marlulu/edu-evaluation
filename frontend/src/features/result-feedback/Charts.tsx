import { Card, Progress, Space, Typography } from 'antd';
import type { ClassDimensionAverage, DimensionScore } from './api';

const { Text, Title } = Typography;

export function RadarChart({ dimensions }: { dimensions: DimensionScore[] }) {
  const size = 260;
  const center = size / 2;
  const radius = 92;
  const levels = [0.25, 0.5, 0.75, 1];
  const points = dimensions.map((dimension, index) => {
    const angle = (-Math.PI / 2) + (index / dimensions.length) * Math.PI * 2;
    const ratio = dimension.maxScore === 0 ? 0 : dimension.score / dimension.maxScore;
    return {
      labelX: center + Math.cos(angle) * (radius + 28),
      labelY: center + Math.sin(angle) * (radius + 28),
      x: center + Math.cos(angle) * radius * ratio,
      y: center + Math.sin(angle) * radius * ratio,
      axisX: center + Math.cos(angle) * radius,
      axisY: center + Math.sin(angle) * radius,
      label: dimension.name
    };
  });

  return (
    <Card title="单份作业雷达图">
      <svg viewBox={`0 0 ${size} ${size}`} className="chart-svg">
        {levels.map((level) => (
          <polygon
            key={level}
            points={points
              .map((point, index) => {
                const angle = (-Math.PI / 2) + (index / dimensions.length) * Math.PI * 2;
                const x = center + Math.cos(angle) * radius * level;
                const y = center + Math.sin(angle) * radius * level;
                return `${x},${y}`;
              })
              .join(' ')}
            fill="none"
            stroke="#d9e2f2"
          />
        ))}
        {points.map((point) => (
          <line key={point.label} x1={center} y1={center} x2={point.axisX} y2={point.axisY} stroke="#d9e2f2" />
        ))}
        <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="rgba(22,119,255,0.22)" stroke="#1677ff" strokeWidth="2" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4" fill="#1677ff" />
            <text x={point.labelX} y={point.labelY} textAnchor="middle" className="chart-label">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </Card>
  );
}

export function DimensionBarChart({ averages }: { averages: ClassDimensionAverage[] }) {
  const grouped = Object.values(
    averages.reduce<Record<string, { label: string; value: number }>>((accumulator, average) => {
      const key = `${average.className}-${average.dimension}`;
      accumulator[key] = {
        label: `${average.className} · ${average.dimension}`,
        value: average.averageScore
      };
      return accumulator;
    }, {})
  ).slice(0, 8);

  return (
    <Card title="班级维度均分柱状图">
      <Space direction="vertical" className="content-stack">
        {grouped.map((item) => (
          <div key={item.label}>
            <Space className="chart-row">
              <Text>{item.label}</Text>
              <Text strong>{item.value.toFixed(1)}</Text>
            </Space>
            <Progress percent={Math.round((item.value / 25) * 100)} showInfo={false} strokeColor="#1677ff" />
          </div>
        ))}
      </Space>
    </Card>
  );
}

export function ComparisonCard({ title, rows }: { title: string; rows: Array<{ label: string; overallScore: number; studentName: string }> }) {
  return (
    <Card title={title}>
      <Space direction="vertical" className="content-stack">
        {rows.slice(0, 6).map((row) => (
          <Space key={`${row.label}-${row.studentName}`} className="chart-row">
            <div>
              <Title level={5} className="compact-title">
                {row.studentName}
              </Title>
              <Text type="secondary">{row.label}</Text>
            </div>
            <Text strong>{row.overallScore}</Text>
          </Space>
        ))}
      </Space>
    </Card>
  );
}
