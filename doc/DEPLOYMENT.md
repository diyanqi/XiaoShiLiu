# 小石榴图文社区部署指南

## 项目简介

小石榴图文社区是一个基于 Express + Vue3 的现代化图文社区平台，支持用户注册、发布图文内容、互动交流等功能。

## 系统要求

- **Docker 部署**：Docker 20.10+ 和 Docker Compose 2.0+
- **传统部署**：Node.js 18+、MySQL 5.7+、npm 或 yarn

> 💡 **宝塔面板部署**：如果您使用宝塔面板，可以参考这个详细的图文教程：[使用宝塔搭建小石榴图文社区完整教程](https://www.sakuraidc.cc/forum-post/3116.html)

---

## 🐋 Docker 一键部署（推荐）

### 1. 克隆项目

```bash
git clone https://github.com/ZTMYO/XiaoShiLiu
cd XiaoShiLiu
```

### 2. 配置环境变量

复制环境配置文件：
```bash
cp .env.docker .env
```

编辑 `.env` 文件，根据需要修改配置：

```env
# 数据库配置
DB_HOST=mysql
DB_USER=xiaoshiliu_user
DB_PASSWORD=123456
DB_NAME=xiaoshiliu
DB_PORT=3306
MYSQL_USER=xiaoshiliu_user
MYSQL_PASSWORD=123456

# JWT配置
JWT_SECRET=xiaoshiliu_secret_key_2025_docker
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
AUTH_OAUTH_ONLY=true

# Casdoor OAuth 配置（必填）
CASDOOR_ENDPOINT=https://door.example.com
CASDOOR_CLIENT_ID=your_client_id
CASDOOR_CLIENT_SECRET=your_client_secret
CASDOOR_CERTIFICATE=
CASDOOR_ORG_NAME=casdoor
CASDOOR_APP_NAME=your_app_name
CASDOOR_REDIRECT_URL=http://localhost:8080/callback

# 上传配置
UPLOAD_MAX_SIZE=50mb
# 图片上传策略 (local: 本地存储, imagehost: 第三方图床, r2: Cloudflare R2)
IMAGE_UPLOAD_STRATEGY=imagehost
# 视频上传策略 (local: 本地存储, r2: Cloudflare R2)
VIDEO_UPLOAD_STRATEGY=local

# 本地存储配置
LOCAL_UPLOAD_DIR=uploads
LOCAL_BASE_URL=http://localhost:3001
VIDEO_UPLOAD_DIR=uploads/videos
VIDEO_COVER_DIR=uploads/covers

# 第三方图床配置（当IMAGE_UPLOAD_STRATEGY=imagehost时使用）
IMAGEHOST_API_URL=https://api.xinyew.cn/api/360tc
IMAGEHOST_TIMEOUT=60000

# Cloudflare R2 配置（当IMAGE_UPLOAD_STRATEGY=r2或VIDEO_UPLOAD_STRATEGY=r2时使用）
# 如需使用R2存储，请取消注释并填入真实配置
# R2_ACCESS_KEY_ID=your_r2_access_key_id_here
# R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
# R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
# R2_BUCKET_NAME=your_bucket_name_here
# R2_ACCOUNT_ID=your_account_id_here
# R2_REGION=auto
# R2_PUBLIC_URL=https://your-custom-domain.com

# API配置
API_BASE_URL=http://localhost:3001

# 邮件服务配置
# 是否启用邮件功能 (true/false)，默认不启用
EMAIL_ENABLED=false
# SMTP服务器地址
SMTP_HOST=smtp.qq.com
# SMTP服务器端口
SMTP_PORT=465
# 是否使用SSL/TLS (true/false)
SMTP_SECURE=true
# 邮箱账号
SMTP_USER=your_email@example.com
# 邮箱密码/授权码
SMTP_PASSWORD=your_email_password
# 发件人邮箱
EMAIL_FROM=your_email@example.com
# 发件人名称
EMAIL_FROM_NAME=小石榴校园图文社区

# 前端构建配置
VITE_API_BASE_URL=http://localhost:3001/api

# 服务端口配置
FRONTEND_PORT=8080
BACKEND_PORT=3001
DB_PORT_EXTERNAL=3307

# 生产环境标识
NODE_ENV=production
```

### 3. 启动服务

使用 PowerShell 脚本（Windows 推荐）：
```powershell
# 基本启动
.\deploy.ps1

# 重新构建并启动
.\deploy.ps1 -Build

# 启动并灌装示例数据
.\deploy.ps1 -Seed

# 查看帮助
.\deploy.ps1 -Help
```

或使用 Docker Compose：
```bash
# 启动服务
docker-compose up -d

# 重新构建并启动
docker-compose up -d --build
```

### 4. 访问应用

- **前端界面**：http://localhost:8080
- **后端API**：http://localhost:3001
- **数据库**：localhost:3307

### 4.1 私信功能数据库迁移（老环境必做）

> 如果是全新部署且没有复用旧数据库，可跳过本节（初始化脚本已包含私信表）。

如果你在已有数据库上升级，请在 MySQL 中执行以下 SQL：

```sql
CREATE TABLE IF NOT EXISTS `private_conversations` (
   `id` bigint(20) NOT NULL AUTO_INCREMENT,
   `user1_id` bigint(20) NOT NULL,
   `user2_id` bigint(20) NOT NULL,
   `user_low_id` bigint(20) GENERATED ALWAYS AS (LEAST(`user1_id`, `user2_id`)) STORED,
   `user_high_id` bigint(20) GENERATED ALWAYS AS (GREATEST(`user1_id`, `user2_id`)) STORED,
   `last_message_id` bigint(20) DEFAULT NULL,
   `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
   `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   UNIQUE KEY `uk_conversation_users` (`user_low_id`, `user_high_id`),
   KEY `idx_user1_id` (`user1_id`),
   KEY `idx_user2_id` (`user2_id`),
   KEY `idx_updated_at` (`updated_at`),
   CONSTRAINT `fk_private_conversation_user1` FOREIGN KEY (`user1_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
   CONSTRAINT `fk_private_conversation_user2` FOREIGN KEY (`user2_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `private_messages` (
   `id` bigint(20) NOT NULL AUTO_INCREMENT,
   `conversation_id` bigint(20) NOT NULL,
   `sender_id` bigint(20) NOT NULL,
   `receiver_id` bigint(20) NOT NULL,
   `content` text NOT NULL,
   `is_read` tinyint(1) NOT NULL DEFAULT 0,
   `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   KEY `idx_conversation_id` (`conversation_id`),
   KEY `idx_receiver_read` (`receiver_id`, `is_read`),
   KEY `idx_created_at` (`created_at`),
   CONSTRAINT `fk_private_message_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `private_conversations` (`id`) ON DELETE CASCADE,
   CONSTRAINT `fk_private_message_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
   CONSTRAINT `fk_private_message_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5. 常用管理命令

```powershell
# 查看服务状态
.\deploy.ps1 -Status

# 查看日志
.\deploy.ps1 -Logs

# 停止服务
.\deploy.ps1 -Stop

# 清理所有数据（谨慎使用）
.\deploy.ps1 -Clean
```

### 6. 推送镜像到 DockerHub

```bash
# 1) 登录 DockerHub（建议使用 Access Token）
docker login

# 2) 构建镜像
docker compose build

# 3) 打标签（替换 yourname）
docker tag xiaoshiliu-backend:latest yourname/xiaoshiliu-backend:latest
docker tag xiaoshiliu-frontend:latest yourname/xiaoshiliu-frontend:latest

# 4) 推送
docker push yourname/xiaoshiliu-backend:latest
docker push yourname/xiaoshiliu-frontend:latest
```

生产环境可直接在 `docker-compose.yml` 中将 `backend`、`frontend` 的 `build` 替换为 `image: yourname/xiaoshiliu-backend:latest` 和 `image: yourname/xiaoshiliu-frontend:latest`。

### 7. 前后端单镜像（Unified）

项目已提供根目录 `Dockerfile.unified`，会把前端构建产物打进后端容器，由 Express 同时提供页面与 API。

```bash
# 构建单镜像
docker build -f Dockerfile.unified -t yourname/xiaoshiliu-unified:latest .

# 推送到 DockerHub
docker push yourname/xiaoshiliu-unified:latest
```

运行时建议仍使用独立 MySQL：

```bash
docker run -d --name xiaoshiliu-unified \
   -p 3001:3001 \
   -e DB_HOST=your_mysql_host \
   -e DB_USER=your_db_user \
   -e DB_PASSWORD=your_db_password \
   -e DB_NAME=xiaoshiliu \
   -e DB_PORT=3306 \
   -e JWT_SECRET=change_me \
   -e AUTH_OAUTH_ONLY=true \
   -e CASDOOR_ENDPOINT=https://door.example.com \
   -e CASDOOR_CLIENT_ID=your_client_id \
   -e CASDOOR_CLIENT_SECRET=your_client_secret \
   -e CASDOOR_ORG_NAME=casdoor \
   -e CASDOOR_APP_NAME=your_app_name \
   -e CASDOOR_REDIRECT_URL=https://yourdomain.com/callback \
   yourname/xiaoshiliu-unified:latest
```

## 🛠️ 传统部署

### 1. 环境准备

确保已安装：
- Node.js 18+
- MySQL 5.7+
- Git

### 2. 克隆项目

```bash
git clone <项目地址>
cd XiaoShiLiu
```

### 3. 数据库配置

确保 MySQL 服务已启动，数据库将通过脚本自动创建和初始化。

### 4. 后端配置

进入后端目录：
```bash
cd express-project
```

复制并配置环境文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
# 服务器配置
PORT=3001
NODE_ENV=development

# JWT配置
JWT_SECRET=xiaoshiliu_secret_key_2025_production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
AUTH_OAUTH_ONLY=true

# Casdoor OAuth 配置
CASDOOR_ENDPOINT=https://door.example.com
CASDOOR_CLIENT_ID=your_client_id
CASDOOR_CLIENT_SECRET=your_client_secret
CASDOOR_CERTIFICATE=
CASDOOR_ORG_NAME=casdoor
CASDOOR_APP_NAME=your_app_name
CASDOOR_REDIRECT_URL=http://localhost:5173/callback

# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=xiaoshiliu
DB_PORT=3306

# API配置
API_BASE_URL=http://localhost:3001

# 上传配置
UPLOAD_MAX_SIZE=50mb
# 图片上传策略 (local: 本地存储, imagehost: 第三方图床, r2: Cloudflare R2)
UPLOAD_STRATEGY=imagehost

# 本地存储配置
LOCAL_UPLOAD_DIR=uploads
LOCAL_BASE_URL=http://localhost:3001

# 第三方图床配置（当UPLOAD_STRATEGY=imagehost时使用）
IMAGEHOST_API_URL=https://api.xinyew.cn/api/360tc
IMAGEHOST_TIMEOUT=60000

# Cloudflare R2 配置（当UPLOAD_STRATEGY=r2时使用）
# 请从 Cloudflare 控制台获取您自己的配置信息
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
R2_BUCKET_NAME=your_bucket_name_here
R2_ACCOUNT_ID=your_account_id_here
R2_REGION=auto
# 可选：如果有自定义域名，可以设置 R2_PUBLIC_URL
# R2_PUBLIC_URL=https://your-custom-domain.com

# CORS配置
CORS_ORIGIN=http://localhost:5173

# 邮件服务配置
# 是否启用邮件功能 (true/false)
# 设置为false时，注册不需要邮箱验证，适合没有SMTP服务的用户
EMAIL_ENABLED=true
# SMTP服务器地址
SMTP_HOST=smtp.qq.com
# SMTP服务器端口
SMTP_PORT=465
# 是否使用SSL/TLS (true/false)
SMTP_SECURE=true
# 邮箱账号
SMTP_USER=your_email@example.com
# 邮箱密码/授权码
SMTP_PASSWORD=your_email_password
# 发件人邮箱
EMAIL_FROM=your_email@example.com
# 发件人名称
EMAIL_FROM_NAME=小石榴校园图文社区
```

安装依赖并初始化数据库：
```bash
npm install
# 初始化数据库结构
cd scripts
node init-database.js
# 生成示例数据（可选）
node generate-data.js
```

启动后端服务：
```bash
npm start
```

### 5. 前端配置

打开新终端，进入前端目录：
```bash
cd vue3-project
```

复制并配置环境文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件，根据后端配置调整：
```env
# 开发环境配置

# API基础URL（需要与后端端口一致）
VITE_API_BASE_URL=http://localhost:3001/api

# 是否使用真实API
VITE_USE_REAL_API=true

# 应用标题
VITE_APP_TITLE=小石榴图文社区
```

安装依赖：
```bash
npm install
```

开发模式启动：
```bash
npm run dev
```

生产模式构建：
```bash
npm run build
npm run preview
```

### 6. 访问应用

- **开发模式**：http://localhost:5173
- **生产模式**：http://localhost:4173
- **后端API**：http://localhost:3001

## 📁 项目结构

```
XiaoShiLiu/
├── express-project/          # 后端项目
│   ├── app.js               # 应用入口
│   ├── package.json         # 后端依赖
│   ├── .env.example         # 后端环境配置模板
│   ├── Dockerfile           # 后端Docker配置
│   └── scripts/
│       └── init-database.sql # 数据库初始化脚本
├── vue3-project/            # 前端项目
│   ├── package.json         # 前端依赖
│   ├── Dockerfile           # 前端Docker配置
│   └── nginx.conf           # Nginx配置
├── docker-compose.yml       # Docker编排配置
├── .env.docker             # Docker环境配置模板
├── deploy.ps1              # Windows部署脚本
└── doc/
    └── DEPLOYMENT.md       # 本文档
```

## 🔧 配置说明

### 上传策略配置

项目支持三种图片上传策略：

1. **本地存储** (`UPLOAD_STRATEGY=local`)
   ```env
   LOCAL_UPLOAD_DIR=uploads
   LOCAL_BASE_URL=http://localhost:3001
   ```

2. **第三方图床** (`UPLOAD_STRATEGY=imagehost`)
   ```env
   IMAGEHOST_API_URL=https://api.xinyew.cn/api/360tc
   IMAGEHOST_TIMEOUT=60000
   ```

3. **Cloudflare R2** (`UPLOAD_STRATEGY=r2`)
   ```env
   R2_ACCESS_KEY_ID=your_access_key
   R2_SECRET_ACCESS_KEY=your_secret_key
   R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
   R2_BUCKET_NAME=your_bucket_name
   R2_ACCOUNT_ID=your_account_id
   R2_REGION=auto
   ```

### Cloudflare R2 配置步骤

1. 登录 Cloudflare 控制台
2. 进入 R2 Object Storage
3. 创建存储桶
4. 生成 API 令牌（权限：R2:Edit）
5. 获取账户 ID
6. 配置环境变量

### 邮件功能配置

项目支持邮箱验证功能，可通过 `EMAIL_ENABLED` 开关控制：

1. **启用邮件功能** (`EMAIL_ENABLED=true`)
   - 注册时需要填写邮箱并验证
   - 需要配置SMTP服务器信息
   ```env
   EMAIL_ENABLED=true
   SMTP_HOST=smtp.qq.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=your_email@example.com
   SMTP_PASSWORD=your_email_password
   EMAIL_FROM=your_email@example.com
   EMAIL_FROM_NAME=小石榴校园图文社区
   ```

2. **禁用邮件功能** (`EMAIL_ENABLED=false`，默认)
   - 注册时不需要邮箱验证
   - 适合没有SMTP服务或不需要邮箱验证的场景
   ```env
   EMAIL_ENABLED=false
   ```

### Casdoor-only 登录配置

当 `AUTH_OAUTH_ONLY=true` 时，系统会禁用账号密码注册/登录/找回密码，仅允许 Casdoor OAuth 登录。

请确保以下配置正确：

```env
AUTH_OAUTH_ONLY=true
CASDOOR_ENDPOINT=https://door.example.com
CASDOOR_CLIENT_ID=your_client_id
CASDOOR_CLIENT_SECRET=your_client_secret
CASDOOR_ORG_NAME=casdoor
CASDOOR_APP_NAME=your_app_name
CASDOOR_REDIRECT_URL=https://yourdomain.com/callback
```

并在 Casdoor 控制台把回调地址加入应用白名单，例如：`https://yourdomain.com/callback`。

### 反向代理配置

**重要提示**：如果您使用了 Nginx、Apache 等反向代理服务器，需要修改以下配置：

#### 后端配置 (express-project/.env)

```env
# 将 API_BASE_URL 改为您的域名和端口
API_BASE_URL=https://yourdomain.com:端口号
# 或者如果使用默认端口（80/443）
API_BASE_URL=https://yourdomain.com

# CORS配置也需要修改为前端访问地址
CORS_ORIGIN=https://yourdomain.com
```

#### 前端配置 (vue3-project/.env)

```env
# 将 API 基础 URL 改为您的域名和后端端口
VITE_API_BASE_URL=https://yourdomain.com:端口号/api
# 或者如果使用默认端口（80/443）
VITE_API_BASE_URL=https://yourdomain.com/api
```

#### 配置示例

假设您的域名是 `example.com`，后端通过反向代理映射到 3001 端口：

**后端 .env：**
```env
API_BASE_URL=https://example.com
CORS_ORIGIN=https://example.com
```

**前端 .env：**
```env
VITE_API_BASE_URL=https://example.com/api
```

**Nginx 配置示例：**
```nginx
server {
    listen 80;
    server_name example.com;

    # 前端静态资源
    location / {
        root /path/to/vue3-project/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:3001/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🚨 故障排除

### Docker 部署问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   netstat -ano | findstr :8080
   # 修改 .env 中的端口配置
   ```

2. **容器启动失败**
   ```bash
   # 查看日志
   docker-compose logs
   # 重新构建
   docker-compose up -d --build
   ```

3. **数据库连接失败**
   ```bash
   # 检查数据库容器状态
   docker-compose ps
   # 重启数据库服务
   docker-compose restart mysql
   ```

### 传统部署问题

1. **Node.js 版本不兼容**
   ```bash
   # 检查版本
   node --version
   # 使用 nvm 切换版本
   nvm use 18
   ```

2. **数据库连接失败**
   - 检查 MySQL 服务是否启动
   - 验证数据库用户权限
   - 确认防火墙设置

3. **依赖安装失败**
   ```bash
   # 清理缓存
   npm cache clean --force
   # 删除 node_modules 重新安装
   rm -rf node_modules
   npm install
   ```

## 📝 注意事项

1. **生产环境部署**：
   - 修改默认密码和密钥
   - 配置 HTTPS
   - 设置防火墙规则
   - 定期备份数据

2. **性能优化**：
   - 使用 CDN 加速静态资源
   - 配置数据库索引
   - 启用 Gzip 压缩

3. **安全建议**：
   - 不要将 `.env` 文件提交到版本控制
   - 定期更新依赖包
   - 使用强密码策略

**祝您部署顺利！** 🎉