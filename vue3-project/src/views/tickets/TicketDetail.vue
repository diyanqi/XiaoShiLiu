<template>
  <div class="ticket-detail-page">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="!ticket" class="empty-state">
      <p>工单不存在</p>
      <button class="btn-secondary" @click="router.back()">返回</button>
    </div>

    <div v-else class="ticket-detail">
      <!-- 头部 -->
   <div class="detail-header">
        <button class="back-btn" @click="router.back()">
          <svg-icon name="arrow-left" />
          返回
        </button>
        
        <div class="header-actions">
          <button
            v-if="ticket.status !== 'closed'"
            class="btn-danger"
            @click="showCloseConfirm = true"
          >
            关闭工单
          </button>
        </div>
      </div>

      <!-- 工单信息卡片 -->
      <div class="ticket-card">
        <div class="card-header">
          <div class="ticket-no">工单号: {{ ticket.ticket_no }}</div>
          <div class="ticket-badges">
            <span :class="['badge', 'priority', ticket.priority]">
              {{ getPriorityText(ticket.priority) }}
            </span>
            <span :class="['badge', 'status', ticket.status]">
              {{ getStatusText(ticket.status) }}
            </span>
          </div>
        </div>

        <h1 class="ticket-subject">{{ ticket.subject }}</h1>

        <div class="ticket-meta">
          <div class="meta-item">
            <span class="label">分类:</span>
            <span class="value">{{ ticket.category_name || '未分类' }}</span>
          </div>
          <div class="meta-item">
            <span class="label">创建时间:</span>
            <span class="value">{{ formatFullTime(ticket.created_at) }}</span>
          </div>
          <div v-if="ticket.resolved_at" class="meta-item">
            <span class="label">解决时间:</span>
            <span class="value">{{ formatFullTime(ticket.resolved_at) }}</span>
          </div>
          <div v-if="ticket.assigned_admin_name" class="meta-item">
            <span class="label">处理人:</span>
            <span class="value">{{ ticket.assigned_admin_name }}</span>
          </div>
        </div>
      </div>

      <!-- 消息列表 -->
      <div class="messages-section">
        <h2 class="section-title">对话记录</h2>
        
        <div class="messages-list">
          <div
            v-for="message in ticket.messages"
            :key="message.id"
            :class="['message-item', message.sender_type]"
          >
            <div class="message-avatar">
              <img
                v-if="message.sender_avatar"
                :src="message.sender_avatar"
                alt="avatar"
              />
              <div v-else class="avatar-placeholder">
                {{ message.sender_type === 'admin' ? '管' : message.sender_name?.[0] || '用' }}
              </div>
            </div>

            <div class="message-content">
              <div class="message-header">
                <span class="sender-name">{{ message.sender_name }}</span>
                <span class="sender-type">
                  {{ message.sender_type === 'admin' ? '客服' : '我' }}
                </span>
                <span class="message-time">{{ formatTime(message.created_at) }}</span>
              </div>
              <div class="message-body">{{ message.content }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 回复输入框 -->
      <div v-if="ticket.status !== 'closed'" class="reply-section">
        <h2 class="section-title">添加回复</h2>
        <div class="reply-form">
          <textarea
            v-model="replyContent"
            rows="4"
            placeholder="请输入您的回复..."
            :disabled="replying"
          ></textarea>
          <div class="reply-actions">
            <button
              class="btn-primary"
              :disabled="!replyContent.trim() || replying"
              @click="submitReply"
            >
              {{ replying ? '发送中...' : '发送回复' }}
            </button>
          </div>
        </div>
      </div>

      <div v-else class="closed-notice">
        <svg-icon name="info" />
        <span>该工单已关闭，无法继续回复</span>
      </div>
    </div>

    <!-- 关闭确认弹窗 -->
    <teleport to="body">
      <div v-if="showCloseConfirm" class="modal-overlay" @click.self="showCloseConfirm = false">
        <div class="modal-content confirm-modal">
          <div class="modal-header">
            <h2>确认关闭工单</h2>
          </div>
          <div class="modal-body">
            <p>关闭工单后将无法继续回复，确定要关闭此工单吗？</p>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="showCloseConfirm = false">取消</button>
            <button class="btn-danger" @click="confirmClose">确认关闭</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ticketApi } from '@/api/tickets'
import SvgIcon from '@/components/SvgIcon.vue'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const ticket = ref(null)
const replyContent = ref('')
const replying = ref(false)
const showCloseConfirm = ref(false)

const ticketId = route.params.id

// 获取工单详情
async function fetchTicketDetail() {
  loading.value = true
  try {
    const response = await ticketApi.getTicketDetail(ticketId)
    if (response.success) {
      ticket.value = response.data
    }
  } catch (error) {
    console.error('获取工单详情失败:', error)
  } finally {
    loading.value = false
  }
}

// 提交回复
async function submitReply() {
  if (!replyContent.value.trim()) return

  replying.value = true
  try {
    const response = await ticketApi.replyTicket(ticketId, {
      content: replyContent.value
    })
    if (response.success) {
      // 重新加载工单详情
      await fetchTicketDetail()
      replyContent.value = ''
    }
  } catch (error) {
    console.error('回复工单失败:', error)
  } finally {
    replying.value = false
  }
}

// 关闭工单
async function confirmClose() {
  try {
    const response = await ticketApi.closeTicket(ticketId)
    if (response.success) {
      showCloseConfirm.value = false
      // 重新加载工单详情
      await fetchTicketDetail()
    }
  } catch (error) {
    console.error('关闭工单失败:', error)
  }
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
  fetchTicketDetail()
})
</script>

<style scoped>
.ticket-detail-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #ff6b6b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  border-color: #ff6b6b;
  color: #ff6b6b;
}

.ticket-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.ticket-no {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #666;
  font-weight: 600;
}

.ticket-badges {
  display: flex;
  gap: 8px;
}

.badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
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

.ticket-subject {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
  line-height: 1.4;
}

.ticket-meta {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.meta-item {
  font-size: 14px;
}

.meta-item .label {
  color: #999;
  margin-right: 8px;
}

.meta-item .value {
  color: #333;
  font-weight: 500;
}

.messages-section {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 20px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.message-item {
  display: flex;
  gap: 12px;
}

.message-avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
}

.message-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}

.message-item.admin .avatar-placeholder {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.sender-name {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.sender-type {
  padding: 2px 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
}

.message-item.admin .sender-type {
  background: #ffe5e5;
  color: #d32f2f;
}

.message-time {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}

.message-body {
  background: #f8f8f8;
  padding: 12px 16px;
  border-radius: 12px;
  color: #333;
  line-height: 1.6;
  font-size: 14px;
  word-wrap: break-word;
}

.message-item.admin .message-body {
  background: #fff3e0;
}

.reply-section {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 24px;
}

.reply-form textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 12px;
  transition: border-color 0.2s;
}

.reply-form textarea:focus {
  outline: none;
  border-color: #ff6b6b;
}

.reply-form textarea:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.reply-actions {
  display: flex;
  justify-content: flex-end;
}

.closed-notice {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #666;
}

/* 按钮样式 */
.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: #ff6b6b;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #ff5252;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f5f5f5;
  color: #666;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-danger {
  background: #d32f2f;
  color: white;
}

.btn-danger:hover {
  background: #b71c1c;
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
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 400px;
  width: 100%;
}

.modal-header {
  padding: 24px 24px 16px;
}

.modal-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.modal-body {
  padding: 0 24px 24px;
}

.modal-body p {
  color: #666;
  line-height: 1.6;
}

.modal-footer {
  padding: 16px 24px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 768px) {
  .ticket-detail-page {
    padding: 16px;
  }

  .detail-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .ticket-meta {
    grid-template-columns: 1fr;
  }

  .message-header {
    flex-wrap: wrap;
  }
}
</style>
