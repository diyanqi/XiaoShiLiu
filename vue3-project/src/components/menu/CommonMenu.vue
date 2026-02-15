<script setup>
import DropdownItem from '@/components/menu/DropdownItem.vue'
import DropdownDivider from '@/components/menu/DropdownDivider.vue'
import ThemeSwitcherMenuItem from '@/components/menu/ThemeSwitcherMenuItem.vue'
import { useUserStore } from '@/stores/user'
import { useAuthStore } from '@/stores/auth'
import { useAboutStore } from '@/stores/about'
import { useKeyboardShortcutsStore } from '@/stores/keyboardShortcuts'
import { useAccountSecurityStore } from '@/stores/accountSecurity'
import ColorPickerMenuItem from '@/components/menu/ColorPickerMenuItem.vue'
const userStore = useUserStore()
const authStore = useAuthStore()
const aboutStore = useAboutStore()
const keyboardShortcutsStore = useKeyboardShortcutsStore()
const accountSecurityStore = useAccountSecurityStore()

// 登录处理 - 直接跳转到Casdoor登录
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

// 退出登录处理
const handleLogout = async () => {
  try {
    await userStore.logout()
    // 退出登录后刷新页面，避免保留错误信息
    window.location.reload()
  } catch (error) {
    console.error('退出登录失败:', error)
  }
}

// 菜单项点击处理
const handleMenuClick = (action) => {
  if (action === 'about') {
    aboutStore.openAboutModal()
  } else if (action === 'logout') {
    handleLogout()
  } else if (action === 'login') {
    handleLoginClick()
  } else if (action === 'accountSecurity') {
    accountSecurityStore.openAccountSecurityModal()
  } else if (action === 'keyboardShortcuts') {
    keyboardShortcutsStore.openKeyboardShortcutsModal()
  }
}
</script>

<template>

  <DropdownItem @click="handleMenuClick('about')">
    关于知识星球
  </DropdownItem>
  <DropdownItem @click="handleMenuClick('keyboardShortcuts')">
    键盘快捷键
  </DropdownItem>
  <DropdownItem v-if="userStore.isLoggedIn" @click="handleMenuClick('accountSecurity')">
    账号与安全
  </DropdownItem>
  <DropdownDivider />
  <ColorPickerMenuItem />
  <ThemeSwitcherMenuItem />

  <DropdownItem v-if="userStore.isLoggedIn" @click="handleMenuClick('logout')">
    退出登录
  </DropdownItem>
  <DropdownItem v-else @click="handleMenuClick('login')">
    登录/注册
  </DropdownItem>
</template>