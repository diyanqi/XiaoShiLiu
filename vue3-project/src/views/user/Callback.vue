<template>
  <div class="callback-container">
    <div class="loading-content">
      <div class="spinner"></div>
      <p>{{ message }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const message = ref('正在跳转登录...')

onMounted(async () => {
  const { code, state } = route.query
  
  if (!code) {
    message.value = '登录失败：缺少授权码'
    setTimeout(() => router.push('/'), 2000)
    return
  }

  try {
    const response = await fetch('/api/auth/casdoor/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, state })
    })
    
    const result = await response.json()
    
    if (result.code === 200) {
      // 登录成功，保存 token
      const { user, tokens } = result.data
      localStorage.setItem('token', tokens.access_token)
      localStorage.setItem('refreshToken', tokens.refresh_token)
      localStorage.setItem('userInfo', JSON.stringify(user))
      
      message.value = '登录成功，正在跳转...'
      // 确保 store 同步
      userStore.token = tokens.access_token
      userStore.refreshToken = tokens.refresh_token
      userStore.userInfo = user
      
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    } else {
      message.value = '登录失败：' + (result.message || '未知错误')
      setTimeout(() => router.push('/'), 2000)
    }
  } catch (error) {
    console.error('Callback error:', error)
    message.value = '登录过程中发生错误'
    setTimeout(() => router.push('/'), 2000)
  }
})
</script>

<style scoped>
.callback-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color-primary);
}

.loading-content {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(var(--primary-color-rgb), 0.1);
  border-top: 4px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

p {
  color: var(--text-color-primary);
  font-size: 16px;
}
</style>