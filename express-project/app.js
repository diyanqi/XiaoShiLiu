/**
 * 小石榴校园图文社区 - Express后端服务
 * 
 * @author ZTMYO
 * @github https://github.com/ZTMYO
 * @description 基于Express框架的图文社区后端API服务
 * @version v1.3.1
 * @license GPLv3
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const config = require('./config/config');
const { HTTP_STATUS, RESPONSE_CODES } = require('./constants');

// 加载环境变量
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// 导入路由模块
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments');
const likesRoutes = require('./routes/likes');
const tagsRoutes = require('./routes/tags');
const searchRoutes = require('./routes/search');
const notificationsRoutes = require('./routes/notifications');
const uploadRoutes = require('./routes/upload');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const categoriesRoutes = require('./routes/categories');
const messagesRoutes = require('./routes/messages');
const ticketsRoutes = require('./routes/tickets');

const app = express();
const frontendDistPath = path.join(__dirname, 'public');
const shouldServeFrontend = process.env.SERVE_FRONTEND === 'true';

// 中间件配置
// CORS配置
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));  // 显式处理OPTIONS请求
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务 - 提供uploads目录的文件访问
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 健康检查路由
app.get('/api/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    code: RESPONSE_CODES.SUCCESS,
    message: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 路由配置
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/tickets', ticketsRoutes);

if (shouldServeFrontend) {
  app.use(express.static(frontendDistPath));

  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '服务器内部错误' });
});

// 404 处理
app.use('*', (req, res) => {
  if (shouldServeFrontend && !req.originalUrl.startsWith('/api')) {
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  }

  res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '接口不存在' });
});

// 数据库自动初始化
const { checkAndInitDatabase } = require('./utils/dbAutoInit');

// 启动服务器（带数据库初始化检查）
const PORT = config.server.port;

async function startServer() {
  try {
    // 检查并初始化数据库
    await checkAndInitDatabase();
    
    // 启动HTTP服务器
    app.listen(PORT, () => {
      console.log(`● 服务器运行在端口 ${PORT}`);
      console.log(`● 环境: ${config.server.env}`);
      console.log(`● 数据库: ${config.database.database}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;