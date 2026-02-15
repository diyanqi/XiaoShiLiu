<template>
  <div class="ticket-management">
    <div class="page-header">
      <h1>工单管理</h1>
    </div>

    <!-- 统计卡片 -->
    <div v-if="stats" class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.open_count }}</div>
        <div class="stat-label">待处理</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.pending_count }}</div>
        <div class="stat-label">等待回复</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.in_progress_count }}</div>
        <div class="stat-label">处理中</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.urgent_count }}</div>
        <div class="stat-label">紧急工单</div>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filters">
      <input
        v-model="filters.keyword"
        type="text"
        placeholder="搜索工单号、主题或用户..."
        class="search-input"
        @input="handleSearch"
      />
      
      <select v-model="filters.status" @change="fetchTickets">
        <option value="">全部状态</option>
        <option value="open">待处理</option>
        <option value="pending">等待回复</option>
        <option value="in_progress">处理中</option>
        <option value="resolved">已解决</option>
        <option value="closed">已关闭</option>
      </select>

      <select v-model="filters.priority" @change="fetchTickets">
        <option value="">全部优先级</option>
        <option value="low">低</option>
        <option value="medium">中</option>
        <option value="high">高</option>
        <option value="urgent">紧急</option>
      </select>
    </div>

    <!-- 工单列表 -->
    <div class="table-container">
      <table v-if="tickets.length > 0" class="data-table">
        <thead>
          <tr>
            <th>工单号</th>
            <th>主题</th>
            <th>用户</th>
            <th>分类</th>
            <th>优先级</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ticket in tickets" :key="ticket.id">
            <td>
              <span class="ticket-no">{{ ticket.ticket_no }}</span>
            </td>
            <td>
              <div class="subject-cell">
                {{ ticket.subject }}
                <span v-if="ticket.unread_count > 0" class="unread-badge">
                  {{ ticket.unread_count }} 新
                </span>
              </div>
            </td>
            <td>{{ ticket.nickname }}</td>
            <td>{{ ticket.category_name || '-' }}</td>
            <td>
              <span :class="['badge', 'priority', ticket.priority]">
                {{ getPriorityText(ticket.priority) }}
              </span>
            </td>
            <td>
              <span :class="['badge', 'status', ticket.status]">
                {{ getStatusText(ticket.status) }}
              </span>
            </td>
            <td>{{ formatTime(ticket.created_at) }}</td>
            <td>
              <button class="btn-action" @click="viewTicket(ticket)">
                查看
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty-state">
        <p>暂无工单</p>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > limit" class="pagination">
      <button
        :disabled="page === 1"
        @click="changePage(page - 1)"
      >
        上一页
      </button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button
        :disabled="page >= totalPages"
        @click="changePage(page + 1)"
      >
        下一页
      </button>
    </div>

    <!-- 工单详情弹窗 -->
    <teleport to="body">
      <div v-if="selectedTicket" class="modal-overlay" @click.self="selectedTicket = null">
        <div class="modal-content ticket-modal">
          <div class="modal-header">
            <div>
              <h2>{{ selectedTicket.subject }}</h2>
              <div class="ticket-no">{{ selectedTicket.ticket_no }}</div>
            </div>
            <button class="close-btn" @click="selectedTicket = null">×</button>
          </div>

          <div class="modal-body">
            <!-- 工单信息 -->
            <div class="ticket-info">
              <div class="info-row">
                <div class="info-item">
                  <label>用户:</label>
                  <span>{{ selectedTicket.nickname }} ({{ selectedTicket.user_id }})</span>
                </div>
                <div class="info-item">
                  <label>分类:</label>
                  <span>{{ selectedTicket.category_name || '未分类' }}</span>
                </div>
              </div>
              <div class="info-row">
                <div class="info-item">
                  <label>优先级:</label>
                  <select v-model="updateData.priority" @change="handleUpdate">
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                  </select>
                </div>
                <div class="info-item">
                  <label>状态:</label>
                  <select v-model="updateData.status" @change="handleUpdate">
                    <option value="open">待处理</option>
                    <option value="pending">等待回复</option>
                    <option value="in_progress">处理中</option>
                    <option value="resolved">已解决</option>
                    <option value="closed">已关闭</option>
                  </select>
                </div>
              </div>
              <div class="info-row">
                <div class="info-item full">
                  <label>创建时间:</label>
                  <span>{{ formatFullTime(selectedTicket.created_at) }}</span>
                </div>
              </div>
            </div>

            <!-- 消息列表 -->
            <div class="messages-section">
              <h3>对话记录</h3>
              <div class="messages-list">
                <div
                  v-for="message in selectedTicket.messages"
                  :key="message.id"
                  :class="['message-item', message.sender_type, { internal: message.is_internal }]"
                >
                  <div class="message-header">
                    <span class="sender">{{ message.sender_name }}</span>
                    <span class="type">{{ message.sender_type === 'admin' ? '客服' : '用户' }}</span>
                    <span v-if="message.is_internal" class="internal-tag">内部备注</span>
                    <span class="time">{{ formatTime(message.created_at) }}</span>
                  </div>
                  <div class="message-content">{{ message.content }}</div>
                </div>
              </div>
            </div>

            <!-- 回复表单 -->
            <div class="reply-section">
              <div class="reply-options">
                <label>
                  <input v-model="replyData.is_internal" type="checkbox" />
                  内部备注（用户不可见）
                </label>
              </div>
              <textarea
                v-model="replyData.content"
                rows="4"
                placeholder="输入回复内容..."
              ></textarea>
              <div class="reply-actions">
                <button
                  class="btn-primary"
                  :disabled="!replyData.content.trim() || replying"
                  @click="submitReply"
                >
                  {{ replying ? '发送中...' : '发送回复' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, reactive, watch } from 'vue'
import { ticketApi } from '@/api/tickets'

const tickets = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const stats = ref(null)
const selectedTicket = ref(null)
const replying = ref(false)

const filters = reactive({
  keyword: '',
  status: '',
  priority: ''
})

const replyData = reactive({
  content: '',
  is_internal: false
})

const updateData = reactive({
  status: '',
  priority: ''
})

let searchTimer = null

const totalPages = computed(() => Math.ceil(total.value / limit.value))

// 获取统计信息
async function fetchStats() {
  try {
    const response = await ticketApi.getTicketStats()
    if (response.success) {
      stats.value = response.data.overview
    }
  } catch (error) {
    console.error('获取统计信息失败:', error)
  }
}

// 获取工单列表
async function fetchTickets() {
  try {
    const params = {
      page: page.value,
      limit: limit.value
    }
    
    if (filters.status) params.status = filters.status
    if (filters.priority) params.priority = filters.priority
    if (filters.keyword) params.keyword = filters.keyword

    const response = await ticketApi.getAdminTickets(params)
    if (response.success) {
      tickets.value = response.data.tickets
      total.value = response.data.total
    }
  } catch (error) {
    console.error('获取工单列表失败:', error)
  }
}

// 查看工单详情
async function viewTicket(ticket) {
  try {
    const response = await ticketApi.getAdminTicketDetail(ticket.id)
    if (response.success) {
      selectedTicket.value = response.data
      updateData.status = response.data.status
      updateData.priority = response.data.priority
    }
  } catch (error) {
    console.error('获取工单详情失败:', error)
  }
}

// 更新工单
async function handleUpdate() {
  if (!selectedTicket.value) return

  try {
    const data = {}
    if (updateData.status !== selectedTicket.value.status) {
      data.status = updateData.status
    }
    if (updateData.priority !== selectedTicket.value.priority) {
      data.priority = updateData.priority
    }

    if (Object.keys(data).length > 0) {
      const response = await ticketApi.updateTicket(selectedTicket.value.id, data)
      if (response.success) {
        selectedTicket.value = response.data
        fetchTickets()
        fetchStats()
      }
    }
  } catch (error) {
    console.error('更新工单失败:', error)
  }
}

// 回复工单
async function submitReply() {
  if (!replyData.content.trim() || !selectedTicket.value) return

  replying.value = true
  try {
    const response = await ticketApi.adminReplyTicket(selectedTicket.value.id, {
      content: replyData.content,
      is_internal: replyData.is_internal
    })
    if (response.success) {
      // 重新加载工单详情
      await viewTicket(selectedTicket.value)
      replyData.content = ''
      replyData.is_internal = false
      fetchTickets()
    }
  } catch (error) {
    console.error('回复工单失败:', error)
  } finally {
    replying.value = false
  }
}

// 搜索处理
function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchTickets()
  }, 500)
}

// 切换页码
function changePage(newPage) {
  page.value = newPage
  fetchTickets()
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString('zh-CN')
}

// 格式化完整时间
function formatFullTime(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取状态文本
function getStatusText(status) {
  const map = {
    open: '待处理',
    pending: '等待回复',
    in_progress: '处理中',
    resolved: '已解决',
    closed: '已关闭'
  }
  return map[status] || status
}

// 获取优先级文本
function getPriorityText(priority) {
  const map = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '紧急'
  }
  return map[priority] || priority
}

onMounted(() => {
  fetchStats()
  fetchTickets()
})
</script>

<style scoped>
.ticket-management {
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #ff6b6b;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-input,
.filters select {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

.search-input {
  flex: 1;
  min-width: 200px;
}

.filters select {
  min-width: 140px;
}

.table-container {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.data-table th {
  background: #f8f8f8;
  font-weight: 600;
  color: #666;
  font-size: 13px;
  text-transform: uppercase;
}

.data-table tr:hover {
  background: #f8f8f8;
}

.ticket-no {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #666;
  font-weight: 600;
}

.subject-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unread-badge {
  background: #ff6b6b;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.badge.priority.low {
  background: #e3f2fd;
  color: #1976d2;
}

.badge.priority.medium {
  background: #fff3e0;
  color: #f57c00;
}

.badge.priority.high {
  background: #ffe5e5;
  color: #d32f2f;
}

.badge.priority.urgent {
  background: #b71c1c;
  color: white;
}

.badge.status {
  background: #f5f5f5;
  color: #666;
}

.badge.status.open {
  background: #e8f5e9;
  color: #2e7d32;
}

.badge.status.in_progress {
  background: #e3f2fd;
  color: #1976d2;
}

.badge.status.pending {
  background: #fff3e0;
  color: #f57c00;
}

.badge.status.resolved,
.badge.status.closed {
  background: #f5f5f5;
  color: #757575;
}

.btn-action {
  padding: 6px 16px;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.btn-action:hover {
  background: #ff5252;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: #999;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.ticket-info {
  background: #f8f8f8;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.info-item.full {
  flex: 1 1 100%;
}

.info-item label {
  color: #666;
  font-weight: 500;
  min-width: 70px;
}

.info-item select {
  padding: 6px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 14px;
}

.messages-section {
  margin-bottom: 20px;
}

.messages-section h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.messages-list {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-item {
  padding: 12px;
  border-radius: 8px;
  background: #f8f8f8;
}

.message-item.admin {
  background: #fff3e0;
}

.message-item.internal {
  background: #e3f2fd;
  border-left: 3px solid #1976d2;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.message-header .sender {
  font-weight: 600;
  color: #333;
}

.message-header .type {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  color: #666;
  font-size: 11px;
}

.message-header .internal-tag {
  background: #1976d2;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.message-header .time {
  margin-left: auto;
  color: #999;
  font-size: 12px;
}

.message-content {
  color: #333;
  line-height: 1.6;
  word-wrap: break-word;
}

.reply-section {
  border-top: 1px solid #e0e0e0;
  padding-top: 20px;
}

.reply-options {
  margin-bottom: 12px;
}

.reply-options label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
}

.reply-section textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 12px;
}

.reply-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  padding: 10px 24px;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-primary:hover:not(:disabled) {
  background: #ff5252;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .info-row {
    flex-direction: column;
    gap: 12px;
  }
  
  .filters {
    flex-direction: column;
  }
  
  .filters select,
  .search-input {
    width: 100%;
  }
}
</style>
