<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useUserStore } from '@/stores/user'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import { messageApi, userApi } from '@/api/index.js'
import SvgIcon from '@/components/SvgIcon.vue'
import MessageToast from '@/components/MessageToast.vue'
import { formatTime } from '@/utils/timeFormat'

const userStore = useUserStore()
const authStore = useAuthStore()
const messageStore = useMessageStore()

const defaultAvatar = new URL('@/assets/imgs/avatar.png', import.meta.url).href
const isLoggedIn = computed(() => userStore.isLoggedIn)

const loadingConversations = ref(false)
const loadingMessages = ref(false)
const creatingConversation = ref(false)
const sending = ref(false)

const conversations = ref([])
const activeConversationId = ref(null)
const messages = ref([])
const messageText = ref('')

const userSearchKeyword = ref('')
const searchingUsers = ref(false)
const searchedUsers = ref([])

const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref('info')

const messageListRef = ref(null)

const activeConversation = computed(() => {
  return conversations.value.find(item => item.id === activeConversationId.value) || null
})

const currentUserId = computed(() => userStore.userInfo?.id)

function openLoginModal() {
  authStore.openLoginModal()
}

function showToastMessage(message, type = 'info') {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
}

async function scrollToBottom() {
  await nextTick()
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

async function loadConversations({ autoSelect = true } = {}) {
  if (!isLoggedIn.value) return

  loadingConversations.value = true
  try {
    const response = await messageApi.getConversations()
    if (!response.success) {
      showToastMessage(response.message || '获取会话失败', 'error')
      return
    }

    conversations.value = response.data?.conversations || []

    if (autoSelect && conversations.value.length > 0) {
      const exists = conversations.value.some(item => item.id === activeConversationId.value)
      if (!exists) {
        await selectConversation(conversations.value[0])
      }
    }
  } catch (error) {
    console.error('加载私信会话失败:', error)
    showToastMessage('加载会话失败，请稍后重试', 'error')
  } finally {
    loadingConversations.value = false
  }
}

async function selectConversation(conversation) {
  if (!conversation?.id) return
  activeConversationId.value = conversation.id
  await loadMessages(conversation.id)
}

async function loadMessages(conversationId) {
  if (!conversationId) return

  loadingMessages.value = true
  try {
    const response = await messageApi.getMessages(conversationId, { page: 1, limit: 200 })
    if (!response.success) {
      showToastMessage(response.message || '获取消息失败', 'error')
      return
    }

    messages.value = response.data?.messages || []

    await messageApi.markConversationRead(conversationId)
    await messageStore.fetchUnreadCount()

    const conversation = conversations.value.find(item => item.id === conversationId)
    if (conversation) {
      conversation.unread_count = 0
    }

    await scrollToBottom()
  } catch (error) {
    console.error('加载私信消息失败:', error)
    showToastMessage('加载消息失败，请稍后重试', 'error')
  } finally {
    loadingMessages.value = false
  }
}

async function sendMessage() {
  const content = messageText.value.trim()
  if (!content || !activeConversationId.value || sending.value) return

  sending.value = true
  try {
    const response = await messageApi.sendMessage(activeConversationId.value, content)
    if (!response.success) {
      showToastMessage(response.message || '发送失败', 'error')
      return
    }

    messageText.value = ''
    messages.value.push(response.data)

    const conversation = conversations.value.find(item => item.id === activeConversationId.value)
    if (conversation) {
      conversation.last_message = response.data.content
      conversation.last_message_time = response.data.created_at
      conversation.last_sender_id = response.data.sender_id
    }

    conversations.value = [...conversations.value].sort((a, b) => {
      return new Date(b.last_message_time || b.updated_at) - new Date(a.last_message_time || a.updated_at)
    })

    await scrollToBottom()
  } catch (error) {
    console.error('发送私信失败:', error)
    showToastMessage('发送失败，请稍后重试', 'error')
  } finally {
    sending.value = false
  }
}

function handleMessageEnter(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

async function searchUsers() {
  const keyword = userSearchKeyword.value.trim()
  if (!keyword) {
    searchedUsers.value = []
    return
  }

  searchingUsers.value = true
  try {
    const response = await userApi.searchUsers(keyword, { page: 1, limit: 8 })
    if (!response.success) {
      showToastMessage(response.message || '搜索用户失败', 'error')
      return
    }

    searchedUsers.value = (response.data?.users || []).filter(item => item.user_id !== userStore.userInfo?.user_id)
  } catch (error) {
    console.error('搜索用户失败:', error)
    showToastMessage('搜索失败，请稍后重试', 'error')
  } finally {
    searchingUsers.value = false
  }
}

async function createConversationWithUser(targetUser) {
  if (!targetUser?.user_id || creatingConversation.value) return

  creatingConversation.value = true
  try {
    const response = await messageApi.createConversation(targetUser.user_id)
    if (!response.success) {
      showToastMessage(response.message || '创建会话失败', 'error')
      return
    }

    await loadConversations({ autoSelect: false })
    const createdId = response.data?.conversationId
    const createdConversation = conversations.value.find(item => item.id === createdId)

    if (createdConversation) {
      await selectConversation(createdConversation)
    }

    userSearchKeyword.value = ''
    searchedUsers.value = []
  } catch (error) {
    console.error('创建私信会话失败:', error)
    showToastMessage('创建会话失败，请稍后重试', 'error')
  } finally {
    creatingConversation.value = false
  }
}

onMounted(async () => {
  if (!isLoggedIn.value) return
  await loadConversations()
  await messageStore.fetchUnreadCount()
})
</script>

<template>
  <div class="messages-page">
    <div v-if="!isLoggedIn" class="login-prompt">
      <SvgIcon name="chat" width="48" height="48" class="prompt-icon" />
      <h3>请先登录</h3>
      <p>登录后即可使用私信功能</p>
      <button class="login-btn" @click="openLoginModal">立即登录</button>
    </div>

    <div v-else class="messages-container">
      <div class="conversation-panel">
        <div class="panel-header">
          <h3>私信</h3>
          <button class="refresh-btn" @click="loadConversations" :disabled="loadingConversations">
            <SvgIcon name="reload" width="18" height="18" />
          </button>
        </div>

        <div class="search-box">
          <input v-model="userSearchKeyword" type="text" placeholder="输入昵称或知识星球号，发起私信" @keyup.enter="searchUsers" />
          <button class="search-btn" @click="searchUsers" :disabled="searchingUsers">搜索</button>
        </div>

        <div v-if="searchedUsers.length > 0" class="search-results">
          <div v-for="item in searchedUsers" :key="item.user_id" class="search-user" @click="createConversationWithUser(item)">
            <img :src="item.avatar || defaultAvatar" :alt="item.nickname" class="avatar" />
            <div class="search-user-info">
              <div class="name">{{ item.nickname }}</div>
              <div class="id">{{ item.user_id }}</div>
            </div>
          </div>
        </div>

        <div class="conversation-list">
          <div v-if="loadingConversations" class="placeholder">加载会话中...</div>
          <div v-else-if="conversations.length === 0" class="placeholder">还没有会话，先搜索用户开始聊天</div>

          <div v-for="item in conversations" :key="item.id" class="conversation-item"
            :class="{ active: activeConversationId === item.id }" @click="selectConversation(item)">
            <img :src="item.target_avatar || defaultAvatar" :alt="item.target_nickname" class="avatar" />
            <div class="conversation-content">
              <div class="top-row">
                <span class="name">{{ item.target_nickname || '未知用户' }}</span>
                <span class="time">{{ formatTime(item.last_message_time || item.updated_at) }}</span>
              </div>
              <div class="bottom-row">
                <span class="last-message">{{ item.last_message || '点击开始聊天' }}</span>
                <span v-if="item.unread_count > 0" class="badge">{{ item.unread_count > 99 ? '99+' : item.unread_count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-panel">
        <div v-if="!activeConversation" class="chat-placeholder">
          <SvgIcon name="chat" width="48" height="48" class="prompt-icon" />
          <p>请选择会话开始聊天</p>
        </div>

        <template v-else>
          <div class="chat-header">
            <img :src="activeConversation.target_avatar || defaultAvatar" :alt="activeConversation.target_nickname" class="avatar" />
            <div class="chat-user">{{ activeConversation.target_nickname }}</div>
          </div>

          <div class="message-list" ref="messageListRef">
            <div v-if="loadingMessages" class="placeholder">加载消息中...</div>
            <div v-else-if="messages.length === 0" class="placeholder">还没有消息，发一条问候吧</div>

            <div v-for="item in messages" :key="item.id" class="message-item"
              :class="{ self: item.sender_id === currentUserId }">
              <div class="bubble">{{ item.content }}</div>
              <div class="time">{{ formatTime(item.created_at) }}</div>
            </div>
          </div>

          <div class="input-area">
            <textarea v-model="messageText" rows="2" maxlength="1000" placeholder="输入消息，按 Enter 发送"
              @keydown="handleMessageEnter"></textarea>
            <button class="send-btn" @click="sendMessage" :disabled="sending || !messageText.trim()">发送</button>
          </div>
        </template>
      </div>
    </div>

    <MessageToast v-if="showToast" :message="toastMessage" :type="toastType" @close="showToast = false" />
  </div>
</template>

<style scoped>
.messages-page {
  padding-top: 88px;
  min-height: 100vh;
  background: var(--bg-color-primary);
}

.messages-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 16px 70px;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 12px;
}

.conversation-panel,
.chat-panel {
  border: 1px solid var(--border-color-primary);
  border-radius: 12px;
  background: var(--bg-color-primary);
  min-height: 72vh;
}

.panel-header,
.chat-header {
  height: 56px;
  border-bottom: 1px solid var(--border-color-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
}

.panel-header h3,
.chat-user {
  font-size: 16px;
  color: var(--text-color-primary);
  margin: 0;
}

.refresh-btn,
.search-btn,
.send-btn,
.login-btn {
  border: none;
  border-radius: 999px;
  cursor: pointer;
}

.refresh-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color-secondary);
  background: var(--bg-color-secondary);
}

.search-box {
  padding: 10px;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border-color-primary);
}

.search-box input,
.input-area textarea {
  width: 100%;
  border: 1px solid var(--border-color-primary);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 14px;
  background: var(--bg-color-primary);
  color: var(--text-color-primary);
  resize: none;
  outline: none;
}

.search-btn,
.send-btn,
.login-btn {
  padding: 0 14px;
  background: var(--primary-color);
  color: var(--button-text-color);
  font-size: 14px;
}

.search-results {
  max-height: 180px;
  overflow-y: auto;
  border-bottom: 1px solid var(--border-color-primary);
}

.search-user,
.conversation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  cursor: pointer;
}

.search-user:hover,
.conversation-item:hover,
.conversation-item.active {
  background: var(--bg-color-secondary);
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.search-user-info,
.conversation-content {
  flex: 1;
  min-width: 0;
}

.name,
.id,
.time,
.last-message,
.bottom-row,
.top-row,
.placeholder,
p {
  color: var(--text-color-secondary);
  font-size: 13px;
}

.name {
  color: var(--text-color-primary);
  font-weight: 600;
}

.top-row,
.bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.last-message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--danger-color);
  color: var(--button-text-color);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

.conversation-list,
.message-list {
  overflow-y: auto;
}

.conversation-list {
  max-height: calc(72vh - 170px);
}

.chat-panel {
  display: flex;
  flex-direction: column;
}

.message-list {
  flex: 1;
  padding: 12px;
}

.message-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 12px;
}

.message-item.self {
  align-items: flex-end;
}

.bubble {
  max-width: 75%;
  border-radius: 12px;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 1.45;
  padding: 8px 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-item.self .bubble {
  background: var(--primary-color);
  color: var(--button-text-color);
}

.message-item .time {
  margin-top: 4px;
  font-size: 12px;
}

.input-area {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--border-color-primary);
  padding: 10px;
  align-items: flex-end;
}

.chat-placeholder,
.login-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  gap: 8px;
}

.prompt-icon {
  color: var(--text-color-quaternary);
}

.placeholder {
  text-align: center;
  padding: 30px 12px;
}

@media (max-width: 900px) {
  .messages-container {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .conversation-panel,
  .chat-panel {
    min-height: 320px;
  }

  .conversation-list {
    max-height: 300px;
  }
}
</style>
