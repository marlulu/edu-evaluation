import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { HashRouter, Routes, Route } from 'react-router-dom';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { StudentDetailPage } from './features/class-management/StudentDetailPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/student/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </HashRouter>
    </ConfigProvider>
  </React.StrictMode>
);
