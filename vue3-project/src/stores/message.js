import { defineStore } from 'pinia'
import { ref } from 'vue'
import { messageApi } from '@/api/index.js'

export const useMessageStore = defineStore('message', () => {
  const unreadCount = ref(0)

  async function fetchUnreadCount() {
    try {
      const response = await messageApi.getUnreadCount()
      unreadCount.value = response?.data?.count || 0
      return unreadCount.value
    } catch (error) {
      console.error('获取私信未读数量失败:', error)
      unreadCount.value = 0
      return 0
    }
  }

  function clearUnreadCount() {
    unreadCount.value = 0
  }

  function resetUnreadCount() {
    unreadCount.value = 0
  }

  return {
    unreadCount,
    fetchUnreadCount,
    clearUnreadCount,
    resetUnreadCount
  }
})