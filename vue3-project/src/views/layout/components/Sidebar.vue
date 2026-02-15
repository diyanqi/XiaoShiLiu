<script setup>
import SvgIcon from '@/components/SvgIcon.vue'
import DropdownMenu from '@/components/menu/DropdownMenu.vue'
import CommonMenu from '@/components/menu/CommonMenu.vue'
import { ref, computed, onMounted, watch } from 'vue'
import { useRouteUtils } from '@/composables/useRouteUtils'
import { useUserStore } from '@/stores/user.js'
import { useNotificationStore } from '@/stores/notification'
import { useMessageStore } from '@/stores/message'
import { useAuthStore } from '@/stores/auth'

const { route, handleExploreClick } = useRouteUtils()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const messageStore = useMessageStore()
const authStore = useAuthStore()

const defaultAvatar = new URL('@/assets/imgs/avatar.png', import.meta.url).href

// 从store获取未读通知数量
const unreadCount = computed(() => notificationStore.unreadCount)
const unreadMessageCount = computed(() => messageStore.unreadCount)

// 菜单项配置
const menuItems = ref([
  { label: '发现', icon: 'home', path: '/explore' },
  { label: '发布', icon: 'publish', path: '/publish' },
  { label: '通知', icon: 'notification', path: '/notification' },
  { label: '私信', icon: 'chat', path: '/messages' },
  { label: '我', icon: 'avatar', path: '/user' },
  { label: '更多', icon: 'menu', path: '' },
]);





// 监听登录状态变化
watch(() => userStore.isLoggedIn, (newValue) => {
  if (newValue) {
    notificationStore.fetchUnreadCount()
    messageStore.fetchUnreadCount()
    console.log('登录状态已改变')
  } else {
    console.log('未登录')
    notificationStore.clearUnreadCount()
    messageStore.clearUnreadCount()
  }
}, { immediate: true })

// 监听路由变化，当从通知页面离开时刷新未读数量
watch(() => route.path, (newPath, oldPath) => {
  if (oldPath === '/notification' && newPath !== '/notification' && userStore.isLoggedIn) {
    // 延迟一下再获取，确保通知已被标记为已读
    setTimeout(() => {
      notificationStore.fetchUnreadCount()
    }, 500)
  }

  if (oldPath === '/messages' && newPath !== '/messages' && userStore.isLoggedIn) {
    setTimeout(() => {
      messageStore.fetchUnreadCount()
    }, 500)
  }
})

// 登录按钮点击处理 - 直接跳转到Casdoor登录
const handleLoginClick = async () => {
  try {
    const response = await fetch('/api/auth/casdoor/login')
    const result = await response.json()
    if (result.code === 200 && result.data.signinUrl) {
      window.location.href = result.data.signinUrl
    } else {
      console.error('获取登录地址失败:', result.message)
      // 如果Casdoor不可用，回退到使用弹窗
      authStore.openLoginModal()
    }
  } catch (error) {
    console.error('Casdoor 登录失败:', error)
    // 网络错误时回退到使用弹窗
    authStore.openLoginModal()
  }
}

function handleAvatarError(event) {
  event.target.src = defaultAvatar
}

// 初始化用户信息
onMounted(() => {
  userStore.initUserInfo()
  if (userStore.isLoggedIn) {
    notificationStore.fetchUnreadCount()
    messageStore.fetchUnreadCount()
  }
})
</script>

<template>
  <nav class="sidebar">
    <ul class="sidebar-menu">

      <li>
        <div class="sidebar-link" @click="handleExploreClick"
          :class="{ 'active-link': route.path.startsWith('/explore') }">
          <span class="sidebar-icon">
            <SvgIcon :name="menuItems[0].icon" width="24px" height="24px"
              :class="{ active: route.path.startsWith('/explore') }" />
          </span>
          <span class="sidebar-label">{{ menuItems[0].label }}</span>
        </div>
      </li>

      <li v-for="item in menuItems.slice(1, 4)" :key="item.label"
        :class="{ 'badge-item': item.icon === 'notification' || item.icon === 'chat' }">
        <RouterLink :to="item.path" class="sidebar-link"
          :class="{ 'active-link': route.path === item.path }">
          <span v-if="item.icon" class="sidebar-icon">
            <SvgIcon :name="item.icon" width="24px" height="24px" :class="{ active: route.path === item.path }" />
          </span>
          <span v-else-if="item.emoji" class="sidebar-icon">{{ item.emoji }}</span>
          <span class="sidebar-label">{{ item.label }}</span>

          <div v-if="item.icon === 'notification' && unreadCount > 0" class="count">{{ unreadCount > 99 ? '···' :
            unreadCount }}</div>
          <div v-if="item.icon === 'chat' && unreadMessageCount > 0" class="count">{{ unreadMessageCount > 99 ? '···' : unreadMessageCount }}</div>
        </RouterLink>
      </li>


      <li v-if="userStore.isLoggedIn">
        <RouterLink :to="menuItems[4].path" class="sidebar-link"
          :class="{ 'active-link': route.path === menuItems[4].path }">
          <span class="sidebar-icon">
            <img :src="userStore.userInfo?.avatar || defaultAvatar" :alt="userStore.userInfo?.nickname || '用户头像'"
              class="avatar-icon" @error="handleAvatarError" />
          </span>
          <span class="sidebar-label">{{ menuItems[4].label }}</span>
        </RouterLink>
      </li>


      <li v-else>
        <button class="login-btn" @click="handleLoginClick">
          登录
        </button>
      </li>
    </ul>

    <div class="sidebar-footer">
      <DropdownMenu direction="up">
        <template #trigger>
          <li class="sidebar-footer-item">
            <div class="sidebar-link">
              <span class="sidebar-icon">
                <SvgIcon :name="menuItems[5].icon" width="24px" height="24px" />
              </span>
              <span class="sidebar-label">{{ menuItems[5].label }}</span>
            </div>
          </li>
        </template>
        <template #menu>
          <CommonMenu />
        </template>
      </DropdownMenu>
    </div>


  </nav>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 228px;
  background: var(--bg-color-primary);
  position: fixed;
  z-index: 100;
  left: max(calc(50% - 750px), 0px);
  top: 72px;
  height: calc(100vh - 72px);
  overflow-y: auto;
  padding: 12px;
  justify-content: space-between;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.sidebar-menu {
  flex: 1;
  list-style: none;
  padding: 0;
  margin: 0;
  left: 16px;
}

.sidebar-menu li {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 700;
  height: 48px;
  margin-bottom: 8px;
}

.sidebar-footer-item {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 700;
  height: 48px;
  margin-bottom: 8px;
  border-radius: 999px;
  list-style: none;
  cursor: pointer;
}

.sidebar-footer-item:hover {
  background: var(--bg-color-secondary);
}

.sidebar-link {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0px 16px;
  color: var(--text-color-primary);
  text-decoration: none;
  border-radius: 999px;
  cursor: pointer;
}

.sidebar-link:hover {
  background: var(--bg-color-secondary);
}

/* 激活状态的链接样式 */
.sidebar-link.active-link {
  background: var(--bg-color-secondary);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.sidebar-footer-item .sidebar-link:hover {
  background: transparent;
}

.icon {
  color: var(--text-color-tertiary);
}

.active {
  color: var(--text-color-primary);
}

.sidebar-icon {
  margin-right: 16px;
  display: flex;
  align-items: center;
}

.avatar-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.sidebar-footer {
  margin-top: auto;
  margin-bottom: 20px;
}

.theme-switcher-container {
  padding: 0;
}

/* 登录按钮样式 */
.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0px 16px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

/* 通知badge样式 */
.badge-item {
  position: relative;
}

.badge-item .count {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--danger-color);
  color: white;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  top: 15px;
  left: 100px;
}

/* 移动端隐藏侧边栏 */
@media (max-width: 960px) {
  .sidebar {
    display: none;
  }
}
</style>