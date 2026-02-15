import request from './request.js'

// 工单相关API
export const ticketApi = {
  // ========== 用户端API ==========
  
  // 获取工单分类列表
  getCategories() {
    return request.get('/tickets/categories')
  },

  // 创建工单
  createTicket(data) {
    return request.post('/tickets', data)
  },

  // 获取我的工单列表
  getMyTickets(params = {}) {
    return request.get('/tickets/my', { params })
  },

  // 获取工单详情
  getTicketDetail(ticketId) {
    return request.get(`/tickets/${ticketId}`)
  },

  // 回复工单
  replyTicket(ticketId, data) {
    return request.post(`/tickets/${ticketId}/messages`, data)
  },

  // 关闭工单
  closeTicket(ticketId) {
    return request.put(`/tickets/${ticketId}/close`)
  },

  // ========== 管理员端API ==========
  
  // 获取所有工单列表（管理员）
  getAdminTickets(params = {}) {
    return request.get('/tickets/admin/list', { params })
  },

  // 获取工单详情（管理员）
  getAdminTicketDetail(ticketId) {
    return request.get(`/tickets/admin/${ticketId}`)
  },

  // 回复工单（管理员）
  adminReplyTicket(ticketId, data) {
    return request.post(`/tickets/admin/${ticketId}/messages`, data)
  },

  // 更新工单（管理员）
  updateTicket(ticketId, data) {
    return request.put(`/tickets/admin/${ticketId}`, data)
  },

  // 获取工单统计信息（管理员）
  getTicketStats() {
    return request.get('/tickets/admin/stats/overview')
  }
}

export default ticketApi
