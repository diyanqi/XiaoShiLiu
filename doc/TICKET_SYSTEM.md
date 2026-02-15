# 工单系统使用指南

## 概述

工单系统为「小石榴图文社区」提供了完整的用户支持和问题跟踪功能。用户可以提交工单报告问题或提出建议,管理员可以在后台统一处理和回复工单。

## 功能特性

### 用户端功能

1. **创建工单**
   - 选择问题分类
   - 填写工单主题
   - 详细描述问题
   - 设置优先级(低/中/高/紧急)

2. **查看工单列表**
   - 查看所有提交的工单
   - 按状态筛选工单
   - 查看工单基本信息和状态

3. **工单详情**
   - 查看工单完整信息
   - 查看对话记录
   - 回复工单
   - 关闭已解决的工单

### 管理端功能

1. **工单管理**
   - 查看所有用户提交的工单
   - 按状态、优先级、分类筛选
   - 搜索工单(支持工单号、主题、用户搜索)

2. **工单处理**
   - 回复用户工单
   - 添加内部备注(用户不可见)
   - 更新工单状态
   - 调整工单优先级
   - 分配工单给管理员

3. **工单统计**
   - 实时查看待处理数量
   - 查看各状态工单统计
   - 监控紧急工单数量

## 数据库表结构

### 1. ticket_categories (工单分类表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| name | varchar(50) | 分类名称 |
| description | varchar(255) | 分类描述 |
| sort_order | int | 排序顺序 |
| is_active | tinyint | 是否启用 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### 2. tickets (工单表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| ticket_no | varchar(32) | 工单编号(唯一) |
| user_id | bigint | 用户ID |
| category_id | int | 分类ID |
| subject | varchar(200) | 工单主题 |
| description | text | 问题描述 |
| priority | enum | 优先级(low/medium/high/urgent) |
| status | enum | 状态(open/pending/in_progress/resolved/closed) |
| assigned_to | bigint | 分配给的管理员ID |
| resolved_at | timestamp | 解决时间 |
| closed_at | timestamp | 关闭时间 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### 3. ticket_messages (工单消息表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| ticket_id | bigint | 工单ID |
| sender_type | enum | 发送者类型(user/admin) |
| sender_id | bigint | 发送者ID |
| content | text | 消息内容 |
| attachments | json | 附件(预留) |
| is_internal | tinyint | 是否内部备注 |
| created_at | timestamp | 创建时间 |

## API接口

### 用户端接口

#### 1. 获取工单分类
```
GET /api/tickets/categories
```

#### 2. 创建工单
```
POST /api/tickets
Body: {
  category_id: number,
  subject: string,
  description: string,
  priority: 'low' | 'medium' | 'high' | 'urgent'
}
```

#### 3. 获取我的工单列表
```
GET /api/tickets/my?status=&category_id=&page=1&limit=20
```

#### 4. 获取工单详情
```
GET /api/tickets/:id
```

#### 5. 回复工单
```
POST /api/tickets/:id/messages
Body: {
  content: string
}
```

#### 6. 关闭工单
```
PUT /api/tickets/:id/close
```

### 管理端接口

#### 1. 获取工单列表
```
GET /api/tickets/admin/list?status=&priority=&category_id=&assigned_to=&keyword=&page=1&limit=20
```

#### 2. 获取工单详情
```
GET /api/tickets/admin/:id
```

#### 3. 回复工单
```
POST /api/tickets/admin/:id/messages
Body: {
  content: string,
  is_internal: boolean
}
```

#### 4. 更新工单
```
PUT /api/tickets/admin/:id
Body: {
  status?: 'open' | 'pending' | 'in_progress' | 'resolved' | 'closed',
  priority?: 'low' | 'medium' | 'high' | 'urgent',
  assigned_to?: number,
  category_id?: number
}
```

#### 5. 获取工单统计
```
GET /api/tickets/admin/stats/overview
```

## 前端路由

### 用户端路由
- `/tickets` - 工单列表页
- `/tickets/:id` - 工单详情页

### 管理端路由
- `/admin/tickets` - 工单管理页

## 工单状态流转

```
open (待处理)
  ↓
pending (等待回复) ←→ in_progress (处理中)
  ↓
resolved (已解决)
  ↓
closed (已关闭)
```

## 使用流程

### 用户提交工单流程
1. 访问工单页面 `/tickets`
2. 点击"创建工单"按钮
3. 选择问题分类
4. 填写工单主题和详细描述
5. 设置优先级(默认为"中")
6. 提交工单
7. 等待管理员回复

### 管理员处理工单流程
1. 访问管理后台工单管理页 `/admin/tickets`
2. 查看待处理工单列表
3. 点击"查看"按钮打开工单详情
4. 阅读用户问题描述
5. 在回复框中输入解决方案
6. (可选)勾选"内部备注"添加仅管理员可见的备注
7. 点击"发送回复"
8. 根据情况更新工单状态:
   - `in_progress` - 正在处理
   - `resolved` - 已解决
   - `closed` - 关闭工单

## 初始化数据

系统已预置以下默认分类:
1. 账号问题 - 账号登录、注册、密码等相关问题
2. 内容问题 - 笔记发布、编辑、删除等相关问题
3. 功能建议 - 产品功能改进和新功能建议
4. 举报投诉 - 违规内容举报、用户投诉等
5. 其他问题 - 其他类型的问题和咨询

## 注意事项

1. **工单编号**: 系统自动生成唯一工单编号,格式为 `TK{timestamp}{random}`
2. **权限控制**: 用户只能查看和回复自己创建的工单
3. **内部备注**: 管理员可以添加内部备注,用户无法查看
4. **工单关闭**: 用户和管理员都可以关闭工单,关闭后无法继续回复
5. **状态自动更新**: 
   - 用户回复后,工单状态自动更新为 `pending`
   - 管理员回复后(非内部备注),工单状态自动更新为 `in_progress`

## 后续扩展建议

1. **附件上传**: 支持用户在工单中上传截图或其他附件
2. **工单评分**: 用户可以对工单处理结果进行评分
3. **邮件通知**: 工单状态变更时发送邮件通知
4. **SLA管理**: 设置工单响应时间和解决时间目标
5. **工单模板**: 为常见问题创建工单模板
6. **知识库**: 基于工单创建FAQ知识库
7. **工单导出**: 支持导出工单数据为Excel/CSV

## 技术栈

- **后端**: Express.js + MySQL
- **前端**: Vue 3 + Composition API
- **样式**: CSS3 (Scoped)
- **路由**: Vue Router
- **HTTP客户端**: Axios

## 文件清单

### 后端文件
- `express-project/routes/tickets.js` - 工单路由
- `express-project/scripts/init-database.sql` - 数据库初始化脚本(包含工单表)

### 前端文件
- `vue3-project/src/api/tickets.js` - 工单API接口
- `vue3-project/src/views/tickets/index.vue` - 用户工单列表页
- `vue3-project/src/views/tickets/TicketDetail.vue` - 用户工单详情页
- `vue3-project/src/views/admin/TicketManagement.vue` - 管理员工单管理页
- `vue3-project/src/router/index.js` - 路由配置(已添加工单路由)

## 部署步骤

1. **数据库初始化**
   ```bash
   # 执行数据库初始化脚本,会自动创建工单相关表
   mysql -u root -p xiaoshiliu < express-project/scripts/init-database.sql
   ```

2. **后端部署**
   ```bash
   cd express-project
   npm install
   npm start
   ```

3. **前端部署**
   ```bash
   cd vue3-project
   npm install
   npm run dev  # 开发环境
   npm run build  # 生产环境
   ```

4. **访问工单系统**
   - 用户端: `http://localhost:5173/tickets`
   - 管理端: `http://localhost:5173/admin/tickets`

## 联系方式

如有问题,请访问项目GitHub页面或联系开发者。

---

*文档版本: 1.0*  
*最后更新: 2026-02-15*
