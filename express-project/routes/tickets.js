const express = require('express');
const router = express.Router();
const { pool } = require('../config/config');
const { authenticateToken } = require('../middleware/auth');
const { HTTP_STATUS, RESPONSE_CODES, ERROR_MESSAGES } = require('../constants');
const crypto = require('crypto');

// 生成工单编号
function generateTicketNo() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TK${timestamp}${random}`;
}

// ========== 用户端API ==========

// 获取工单分类列表
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT id, name, description FROM ticket_categories WHERE is_active = 1 ORDER BY sort_order ASC'
    );

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: categories,
      message: 'success'
    });
  } catch (error) {
    console.error('获取工单分类失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 创建工单
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category_id, subject, description, priority = 'medium' } = req.body;

    // 验证必填字段
    if (!subject || !description) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '主题和问题描述不能为空'
      });
    }

    // 验证分类ID（如果提供）
    if (category_id) {
      const [categoryRows] = await pool.execute(
        'SELECT id FROM ticket_categories WHERE id = ? AND is_active = 1',
        [category_id]
      );
      if (categoryRows.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: RESPONSE_CODES.VALIDATION_ERROR,
          message: '无效的分类ID'
        });
      }
    }

    // 验证优先级
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '无效的优先级'
      });
    }

    const ticketNo = generateTicketNo();

    // 开启事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 插入工单
      const [ticketResult] = await connection.execute(
        `INSERT INTO tickets (ticket_no, user_id, category_id, subject, description, priority, status) 
         VALUES (?, ?, ?, ?, ?, ?, 'open')`,
        [ticketNo, userId.toString(), category_id, subject, description, priority]
      );

      const ticketId = ticketResult.insertId;

      // 插入初始消息（用户提交的问题描述）
      await connection.execute(
        `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, content) 
         VALUES (?, 'user', ?, ?)`,
        [ticketId.toString(), userId.toString(), description]
      );

      await connection.commit();

      // 获取完整的工单信息
      const [ticketRows] = await pool.execute(
        `SELECT t.*, tc.name AS category_name, u.nickname, u.avatar, u.user_id 
         FROM tickets t
         LEFT JOIN ticket_categories tc ON t.category_id = tc.id
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = ?`,
        [ticketId.toString()]
      );

      res.status(HTTP_STATUS.CREATED).json({
        code: RESPONSE_CODES.SUCCESS,
        data: ticketRows[0],
        message: '工单创建成功'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('创建工单失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 获取我的工单列表
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, category_id, page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = ['t.user_id = ?'];
    let queryParams = [userId.toString()];

    if (status) {
      whereConditions.push('t.status = ?');
      queryParams.push(status);
    }

    if (category_id) {
      whereConditions.push('t.category_id = ?');
      queryParams.push(category_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // 查询总数
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM tickets t WHERE ${whereClause}`,
      queryParams
    );

    // 查询列表
    const [tickets] = await pool.execute(
      `SELECT t.*, tc.name AS category_name,
              (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) AS message_count
       FROM tickets t
       LEFT JOIN ticket_categories tc ON t.category_id = tc.id
       WHERE ${whereClause}
       ORDER BY t.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), parseInt(offset)]
    );

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        tickets,
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit)
      },
      message: 'success'
    });
  } catch (error) {
    console.error('获取工单列表失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 获取工单详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const ticketId = req.params.id;

    // 查询工单信息
    const [ticketRows] = await pool.execute(
      `SELECT t.*, tc.name AS category_name, u.nickname, u.avatar, u.user_id,
              a.username AS assigned_admin_name
       FROM tickets t
       LEFT JOIN ticket_categories tc ON t.category_id = tc.id
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN admin a ON t.assigned_to = a.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (ticketRows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '工单不存在'
      });
    }

    const ticket = ticketRows[0];

    // 检查权限：只能查看自己的工单
    if (ticket.user_id !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: RESPONSE_CODES.FORBIDDEN,
        message: '无权访问该工单'
      });
    }

    // 查询工单消息（排除内部备注）
    const [messages] = await pool.execute(
      `SELECT tm.*, 
              CASE 
                WHEN tm.sender_type = 'user' THEN u.nickname
                WHEN tm.sender_type = 'admin' THEN a.username
              END AS sender_name,
              CASE 
                WHEN tm.sender_type = 'user' THEN u.avatar
                ELSE NULL
              END AS sender_avatar
       FROM ticket_messages tm
       LEFT JOIN users u ON tm.sender_type = 'user' AND tm.sender_id = u.id
       LEFT JOIN admin a ON tm.sender_type = 'admin' AND tm.sender_id = a.id
       WHERE tm.ticket_id = ? AND tm.is_internal = 0
       ORDER BY tm.created_at ASC`,
      [ticketId]
    );

    ticket.messages = messages;

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: ticket,
      message: 'success'
    });
  } catch (error) {
    console.error('获取工单详情失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 回复工单
router.post('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const ticketId = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '回复内容不能为空'
      });
    }

    // 检查工单是否存在且属于当前用户
    const [ticketRows] = await pool.execute(
      'SELECT id, user_id, status FROM tickets WHERE id = ?',
      [ticketId]
    );

    if (ticketRows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '工单不存在'
      });
    }

    const ticket = ticketRows[0];

    if (ticket.user_id !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: RESPONSE_CODES.FORBIDDEN,
        message: '无权操作该工单'
      });
    }

    // 检查工单状态
    if (ticket.status === 'closed') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '工单已关闭，无法回复'
      });
    }

    // 插入消息
    const [result] = await pool.execute(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, content) 
       VALUES (?, 'user', ?, ?)`,
      [ticketId, userId.toString(), content.trim()]
    );

    // 更新工单状态为pending（等待管理员回复）
    await pool.execute(
      `UPDATE tickets SET status = 'pending', updated_at = NOW() WHERE id = ?`,
      [ticketId]
    );

    // 获取新插入的消息
    const [messageRows] = await pool.execute(
      `SELECT tm.*, u.nickname AS sender_name, u.avatar AS sender_avatar
       FROM ticket_messages tm
       LEFT JOIN users u ON tm.sender_id = u.id
       WHERE tm.id = ?`,
      [result.insertId.toString()]
    );

    res.status(HTTP_STATUS.CREATED).json({
      code: RESPONSE_CODES.SUCCESS,
      data: messageRows[0],
      message: '回复成功'
    });
  } catch (error) {
    console.error('回复工单失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 关闭工单
router.put('/:id/close', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const ticketId = req.params.id;

    // 检查工单是否存在且属于当前用户
    const [ticketRows] = await pool.execute(
      'SELECT id, user_id, status FROM tickets WHERE id = ?',
      [ticketId]
    );

    if (ticketRows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '工单不存在'
      });
    }

    const ticket = ticketRows[0];

    if (ticket.user_id !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: RESPONSE_CODES.FORBIDDEN,
        message: '无权操作该工单'
      });
    }

    // 更新工单状态
    await pool.execute(
      `UPDATE tickets SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [ticketId]
    );

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: '工单已关闭'
    });
  } catch (error) {
    console.error('关闭工单失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// ========== 管理端API ==========

// 获取所有工单列表（管理员）
router.get('/admin/list', authenticateToken, async (req, res) => {
  try {
    // 检查是否为管理员
    if (!req.user.type || req.user.type !== 'admin') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: RESPONSE_CODES.FORBIDDEN,
        message: '权限不足'
      });
    }

    const { status, category_id, priority, assigned_to, page = 1, limit = 20, keyword } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];

    if (status) {
      whereConditions.push('t.status = ?');
      queryParams.push(status);
    }

    if (category_id) {
      whereConditions.push('t.category_id = ?');
      queryParams.push(category_id);
    }

    if (priority) {
      whereConditions.push('t.priority = ?');
      queryParams.push(priority);
    }

    if (assigned_to) {
      whereConditions.push('t.assigned_to = ?');
      queryParams.push(assigned_to);
    }

    if (keyword) {
      whereConditions.push('(t.ticket_no LIKE ? OR t.subject LIKE ? OR u.nickname LIKE ?)');
      const searchTerm = `%${keyword}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // 查询总数
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM tickets t 
       LEFT JOIN users u ON t.user_id = u.id
       ${whereClause}`,
      queryParams
    );

    // 查询列表
    const [tickets] = await pool.execute(
      `SELECT t.*, tc.name AS category_name, u.nickname, u.avatar, u.user_id,
              a.username AS assigned_admin_name,
              (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) AS message_count,
              (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id AND sender_type = 'user' AND created_at > IFNULL(t.resolved_at, '1970-01-01')) AS unread_count
       FROM tickets t
       LEFT JOIN ticket_categories tc ON t.category_id = tc.id
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN admin a ON t.assigned_to = a.id
       ${whereClause}
       ORDER BY 
         CASE t.status 
           WHEN 'open' THEN 1 
           WHEN 'pending' THEN 2 
           WHEN 'in_progress' THEN 3 
           WHEN 'resolved' THEN 4 
           ELSE 5 
         END,
         CASE t.priority 
           WHEN 'urgent' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           ELSE 4 
         END,
         t.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), parseInt(offset)]
    );

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        tickets,
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit)
      },
      message: 'success'
    });
  } catch (error) {
    console.error('获取工单列表失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 获取工单详情（管理员）
router.get('/admin/:id', authenticateToken, async (req, res) => {
  try {
    // 检查是否为管理员
    if (!req.user.type || req.user.type !== 'admin') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: RESPONSE_CODES.FORBIDDEN,
        message: '权限不足'
      });
    }

    const ticketId = req.params.id;

    // 查询工单信息
    const [ticketRows] = await pool.execute(
      `SELECT t.*, tc.name AS category_name, u.nickname, u.avatar, u.user_id, u.email,
              a.username AS assigned_admin_name
       FROM tickets t
       LEFT JOIN ticket_categories tc ON t.category_id = tc.id
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN admin a ON t.assigned_to = a.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (ticketRows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '工单不存在'
      });
    }

    const ticket = ticketRows[0];

    // 查询所有消息（包括内部备注）
    const [messages] = await pool.execute(
      `SELECT tm.*, 
              CASE 
                WHEN tm.sender_type = 'user' THEN u.nickname
                WHEN tm.sender_type = 'admin' THEN a.username
              END AS sender_name,
              CASE 
                WHEN tm.sender_type = 'user' THEN u.avatar
                ELSE NULL
              END AS sender_avatar
       FROM ticket_messages tm
       LEFT JOIN users u ON tm.sender_type = 'user' AND tm.sender_id = u.id
       LEFT JOIN admin a ON tm.sender_type = 'admin' AND tm.sender_id = a.id
       WHERE tm.ticket_id = ?
       ORDER BY tm.created_at ASC`,
      [ticketId]
    );

    ticket.messages = messages;

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: ticket,
      message: 'success'
    });
  } catch (error) {
    console.error('获取工单详情失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 回复工单（管理员）
router.post('/admin/:id/messages', authenticateToken, async (req, res) => {
  try {
    // 检查是否为管理员
    if (!req.user.type || req.user.type !== 'admin') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: RESPONSE_CODES.FORBIDDEN,
        message: '权限不足'
      });
    }

    const adminId = req.user.id;
    const ticketId = req.params.id;
    const { content, is_internal = false } = req.body;

    if (!content || !content.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '回复内容不能为空'
      });
    }

    // 检查工单是否存在
    const [ticketRows] = await pool.execute(
      'SELECT id, status FROM tickets WHERE id = ?',
      [ticketId]
    );

    if (ticketRows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '工单不存在'
      });
    }

    // 开启事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 插入消息
      const [result] = await connection.execute(
        `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, content, is_internal) 
         VALUES (?, 'admin', ?, ?, ?)`,
        [ticketId, adminId.toString(), content.trim(), is_internal ? 1 : 0]
      );

      // 如果不是内部备注，更新工单状态为in_progress
      if (!is_internal) {
        await connection.execute(
          `UPDATE tickets SET status = 'in_progress', updated_at = NOW() WHERE id = ?`,
          [ticketId]
        );
      }

      await connection.commit();

      // 获取新插入的消息
      const [messageRows] = await connection.execute(
        `SELECT tm.*, a.username AS sender_name
         FROM ticket_messages tm
         LEFT JOIN admin a ON tm.sender_id = a.id
         WHERE tm.id = ?`,
        [result.insertId.toString()]
      );

      res.status(HTTP_STATUS.CREATED).json({
        code: RESPONSE_CODES.SUCCESS,
        data: messageRows[0],
        message: '回复成功'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('回复工单失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 更新工单状态和分配（管理员）
router.put('/admin/:id', authenticateToken, async (req, res) => {
  try {
    // 检查是否为管理员
    if (!req.user.type || req.user.type !== 'admin') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: RESPONSE_CODES.FORBIDDEN,
        message: '权限不足'
      });
    }

    const ticketId = req.params.id;
    const { status, priority, assigned_to, category_id } = req.body;

    // 检查工单是否存在
    const [ticketRows] = await pool.execute(
      'SELECT id FROM tickets WHERE id = ?',
      [ticketId]
    );

    if (ticketRows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '工单不存在'
      });
    }

    const updates = [];
    const params = [];

    if (status) {
      const validStatuses = ['open', 'pending', 'in_progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: RESPONSE_CODES.VALIDATION_ERROR,
          message: '无效的工单状态'
        });
      }
      updates.push('status = ?');
      params.push(status);

      if (status === 'resolved') {
        updates.push('resolved_at = NOW()');
      } else if (status === 'closed') {
        updates.push('closed_at = NOW()');
      }
    }

    if (priority) {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: RESPONSE_CODES.VALIDATION_ERROR,
          message: '无效的优先级'
        });
      }
      updates.push('priority = ?');
      params.push(priority);
    }

    if (assigned_to !== undefined) {
      if (assigned_to === null) {
        updates.push('assigned_to = NULL');
      } else {
        // 验证管理员是否存在
        const [adminRows] = await pool.execute(
          'SELECT id FROM admin WHERE id = ?',
          [assigned_to]
        );
        if (adminRows.length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            code: RESPONSE_CODES.VALIDATION_ERROR,
            message: '无效的管理员ID'
          });
        }
        updates.push('assigned_to = ?');
        params.push(assigned_to);
      }
    }

    if (category_id !== undefined) {
      if (category_id === null) {
        updates.push('category_id = NULL');
      } else {
        // 验证分类是否存在
        const [categoryRows] = await pool.execute(
          'SELECT id FROM ticket_categories WHERE id = ? AND is_active = 1',
          [category_id]
        );
        if (categoryRows.length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            code: RESPONSE_CODES.VALIDATION_ERROR,
            message: '无效的分类ID'
          });
        }
        updates.push('category_id = ?');
        params.push(category_id);
      }
    }

    if (updates.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '没有要更新的字段'
      });
    }

    updates.push('updated_at = NOW()');
    params.push(ticketId);

    await pool.execute(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // 获取更新后的工单信息
    const [updatedTicket] = await pool.execute(
      `SELECT t.*, tc.name AS category_name, u.nickname, u.avatar, u.user_id,
              a.username AS assigned_admin_name
       FROM tickets t
       LEFT JOIN ticket_categories tc ON t.category_id = tc.id
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN admin a ON t.assigned_to = a.id
       WHERE t.id = ?`,
      [ticketId]
    );

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: updatedTicket[0],
      message: '工单更新成功'
    });
  } catch (error) {
    console.error('更新工单失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 获取工单统计信息（管理员）
router.get('/admin/stats/overview', authenticateToken, async (req, res) => {
  try {
    // 检查是否为管理员
    if (!req.user.type || req.user.type !== 'admin') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: RESPONSE_CODES.FORBIDDEN,
        message: '权限不足'
      });
    }

    // 按状态统计
    const [statusStats] = await pool.execute(
      `SELECT status, COUNT(*) AS count FROM tickets GROUP BY status`
    );

    // 按优先级统计
    const [priorityStats] = await pool.execute(
      `SELECT priority, COUNT(*) AS count FROM tickets GROUP BY priority`
    );

    // 按分类统计
    const [categoryStats] = await pool.execute(
      `SELECT tc.name, COUNT(t.id) AS count 
       FROM ticket_categories tc
       LEFT JOIN tickets t ON tc.id = t.category_id
       GROUP BY tc.id, tc.name
       ORDER BY count DESC`
    );

    // 总览统计
    const [overview] = await pool.execute(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) AS urgent_count,
        SUM(CASE WHEN assigned_to IS NULL THEN 1 ELSE 0 END) AS unassigned_count
       FROM tickets`
    );

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        overview: overview[0],
        statusStats,
        priorityStats,
        categoryStats
      },
      message: 'success'
    });
  } catch (error) {
    console.error('获取工单统计失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

module.exports = router;
