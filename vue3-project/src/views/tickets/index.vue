<template>
  <div class="tickets-page">
    <div class="page-header">
      <h1>我的工单</h1>
      <button class="btn-primary" @click="showCreateModal = true">
        <svg-icon name="add" />
        创建工单
      </button>
    </div>

    <!-- 筛选器 -->
    <div class="filters">
      <div class="filter-group">
        <button
          v-for="item in statusFilters"
          :key="item.value"
          :class="['filter-btn', { active: activeStatus === item.value }]"
          @click="filterByStatus(item.value)"
        >
          {{ item.label }}
          <span v-if="item.count !== undefined" class="count">{{ item.count }}</span>
        </button>
      </div>
    </div>

    <!-- 工单列表 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="tickets.length === 0" class="empty-state">
      <svg-icon name="ticket" class="empty-icon" />
      <p>暂无工单</p>
      <button class="btn-secondary" @click="showCreateModal = true">创建第一个工单</button>
    </div>

    <div v-else class="tickets-list">
      <div
        v-for="ticket in tickets"
        :key="ticket.id"
        class="ticket-item"
        @click="viewTicket(ticket.id)"
      >
        <div class="ticket-header">
          <div class="ticket-no">{{ ticket.ticket_no }}</div>
          <div class="ticket-badges">
            <span :class="['badge', 'priority', ticket.priority]">
              {{ getPriorityText(ticket.priority) }}
            </span>
            <span :class="['badge', 'status', ticket.status]">
              {{ getStatusText(ticket.status) }}
            </span>
          </div>
        </div>

        <div class="ticket-content">
          <h3 class="ticket-subject">{{ ticket.subject }}</h3>
          <p class="ticket-desc">{{ truncate(ticket.description, 100) }}</p>
        </div>

        <div class="ticket-footer">
          <div class="ticket-meta">
            <span v-if="ticket.category_name" class="category">
              <svg-icon name="folder" />
              {{ ticket.category_name }}
            </span>
            <span class="time">
              <svg-icon name="clock" />
              {{ formatTime(ticket.created_at) }}
            </span>
            <span v-if="ticket.message_count" class="messages">
              <svg-icon name="chat" />
              {{ ticket.message_count }} 条回复
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > limit" class="pagination">
      <button
        class="btn-secondary"
        :disabled="page === 1"
        @click="changePage(page - 1)"
      >
        上一页
      </button>
      <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
      <button
        class="btn-secondary"
        :disabled="page >= totalPages"
        @click="changePage(page + 1)"
      >
        下一页
      </button>
    </div>

    <!-- 创建工单弹窗 -->
    <teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal-content create-ticket-modal">
          <div class="modal-header">
            <h2>创建工单</h2>
            <button class="close-btn" @click="showCreateModal = false">
              <svg-icon name="close" />
            </button>
          </div>

          <div class="modal-body">
            <form @submit.prevent="submitTicket">
              <div class="form-group">
                <label>问题分类</label>
                <select v-model="formData.category_id" required>
                  <option value="">请选择分类</option>
                  <option
                    v-for="category in categories"
                    :key="category.id"
                    :value="category.id"
                  >
                    {{ category.name }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label>工单主题 *</label>
                <input
                  v-model="formData.subject"
                  type="text"
                  placeholder="请简要描述您的问题"
                  maxlength="200"
                  required
                />
              </div>

              <div class="form-group">
                <label>问题描述 *</label>
                <textarea
                  v-model="formData.description"
                  rows="6"
                  placeholder="请详细描述您遇到的问题，以便我们更好地帮助您"
                  required
                ></textarea>
              </div>

              <div class="form-group">
                <label>优先级</label>
                <div class="priority-options">
                  <label
                    v-for="priority in priorityOptions"
                    :key="priority.value"
                    :class="['priority-option', { active: formData.priority === priority.value }]"
                  >
                    <input
                      v-model="formData.priority"
                      type="radio"
                      :value="priority.value"
                    />
                    <span>{{ priority.label }}</span>
                  </label>
                </div>
              </div>

              <div class="form-actions">
                <button type="button" class="btn-secondary" @click="showCreateModal = false">
                  取消
                </button>
                <button type="submit" class="btn-primary" :disabled="submitting">
                  {{ submitting ? '提交中...' : '提交工单' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ticketApi } from '@/api/tickets'
import SvgIcon from '@/components/SvgIcon.vue'

const router = useRouter()

const loading = ref(false)
const tickets = ref([])
const categories = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const activeStatus = ref('')

const showCreateModal = ref(false)
const submitting = ref(false)

const formData = ref({
  category_id: '',
  subject: '',
  description: '',
  priority: 'medium'
})

const statusFilters = ref([
  { label: '全部', value: '' },
  { label: '待处理', value: 'open' },
  { label: '处理中', value: 'in_progress' },
  { label: '等待回复', value: 'pending' },
  { label: '已解决', value: 'resolved' },
  { label: '已关闭', value: 'closed' }
])

const priorityOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'urgent' }
]

const totalPages = computed(() => Math.ceil(total.value / limit.value))

// 获取工单列表
async function fetchTickets() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      limit: limit.value
    }
    if (activeStatus.value) {
      params.status = activeStatus.value
    }

    const response = await ticketApi.getMyTickets(params)
    if (response.success) {
      tickets.value = response.data.tickets
      total.value = response.data.total
    }
  } catch (error) {
    console.error('获取工单列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 获取分类列表
async function fetchCategories() {
  try {
    const response = await ticketApi.getCategories()
    if (response.success) {
      categories.value = response.data
    }
  } catch (error) {
    console.error('获取分类列表失败:', error)
  }
}

// 创建工单
async function submitTicket() {
  submitting.value = true
  try {
    const response = await ticketApi.createTicket(formData.value)
    if (response.success) {
      showCreateModal.value = false
      formData.value = {
        category_id: '',
        subject: '',
        description: '',
        priority: 'medium'
      }
      // 重新加载列表
      await fetchTickets()
      // 跳转到详情页
      router.push(`/tickets/${response.data.id}`)
    }
  } catch (error) {
    console.error('创建工单失败:', error)
  } finally {
    submitting.value = false
  }
}

// 查看工单详情
function viewTicket(ticketId) {
  router.push(`/tickets/${ticketId}`)
}

// 按状态筛选
function filterByStatus(status) {
  activeStatus.value = status
  page.value = 1
  fetchTickets()
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

// 截断文本
function truncate(text, length) {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
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
  fetchTickets()
  fetchCategories()
})
</script>

<style scoped>
.tickets-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: #1a1a1a;
}

.filters {
  margin-bottom: 24px;
}

.filter-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  background: white;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-btn:hover {
  border-color: #ff6b6b;
  color: #ff6b6b;
}

.filter-btn.active {
  background: #ff6b6b;
  color: white;
  border-color: #ff6b6b;
}

.filter-btn .count {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
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
  to { transform: rotate(360deg); }
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.tickets-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ticket-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.ticket-item:hover {
  border-color: #ff6b6b;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
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

.ticket-content {
  margin-bottom: 16px;
}

.ticket-subject {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.ticket-desc {
  color: #666;
  font-size: 14px;
  line-height: 1.6;
}

.ticket-footer {
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}

.ticket-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #999;
}

.ticket-meta > span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
}

.page-info {
  color: #666;
  font-size: 14px;
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
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.close-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #999;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-group input[type="text"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #ff6b6b;
}

.priority-options {
  display: flex;
  gap: 12px;
}

.priority-option {
  flex: 1;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.priority-option input {
  display: none;
}

.priority-option:hover {
  border-color: #ff6b6b;
}

.priority-option.active {
  background: #ff6b6b;
  color: white;
  border-color: #ff6b6b;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.btn-primary,
.btn-secondary {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
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

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .tickets-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .priority-options {
    flex-wrap: wrap;
  }

  .priority-option {
    flex-basis: calc(50% - 6px);
  }
}
</style>
