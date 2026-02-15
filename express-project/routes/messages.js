const express = require('express');
const router = express.Router();
const { pool } = require('../config/config');
const { authenticateToken } = require('../middleware/auth');
const { HTTP_STATUS, RESPONSE_CODES, ERROR_MESSAGES } = require('../constants');

router.use(authenticateToken);

async function resolveUserId(userIdentifier) {
  if (!userIdentifier) return null;

  const [rows] = await pool.execute(
    'SELECT id, user_id, nickname, avatar, verified FROM users WHERE user_id = ? OR id = ? LIMIT 1',
    [String(userIdentifier), String(userIdentifier)]
  );

  return rows.length > 0 ? rows[0] : null;
}

async function getConversationForUser(conversationId, userId) {
  const [rows] = await pool.execute(
    `SELECT id, user1_id, user2_id
     FROM private_conversations
     WHERE id = ? AND (user1_id = ? OR user2_id = ?)
     LIMIT 1`,
    [String(conversationId), String(userId), String(userId)]
  );
  return rows.length > 0 ? rows[0] : null;
}

router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(
      `SELECT c.id,
              c.updated_at,
              lm.id AS last_message_id,
              lm.content AS last_message,
              lm.created_at AS last_message_time,
              lm.sender_id AS last_sender_id,
              u.id AS target_auto_id,
              u.user_id AS target_user_id,
              u.nickname AS target_nickname,
              u.avatar AS target_avatar,
              u.verified AS target_verified,
              (
                SELECT COUNT(*)
                FROM private_messages pm
                WHERE pm.conversation_id = c.id
                  AND pm.receiver_id = ?
                  AND pm.is_read = 0
              ) AS unread_count
       FROM private_conversations c
       LEFT JOIN private_messages lm ON lm.id = c.last_message_id
       JOIN users u ON u.id = (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END)
       WHERE c.user1_id = ? OR c.user2_id = ?
       ORDER BY COALESCE(lm.created_at, c.updated_at) DESC`,
      [String(userId), String(userId), String(userId), String(userId)]
    );

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        conversations: rows
      }
    });
  } catch (error) {
    console.error('获取私信会话失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

router.post('/conversations', async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '目标用户不能为空'
      });
    }

    const targetUser = await resolveUserId(targetUserId);
    if (!targetUser) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '目标用户不存在'
      });
    }

    if (Number(targetUser.id) === Number(userId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '不能和自己发起私信'
      });
    }

    let [conversationRows] = await pool.execute(
      `SELECT id
       FROM private_conversations
       WHERE (user1_id = ? AND user2_id = ?)
          OR (user1_id = ? AND user2_id = ?)
       LIMIT 1`,
      [String(userId), String(targetUser.id), String(targetUser.id), String(userId)]
    );

    let conversationId;

    if (conversationRows.length > 0) {
      conversationId = conversationRows[0].id;
    } else {
      const [result] = await pool.execute(
        'INSERT INTO private_conversations (user1_id, user2_id) VALUES (?, ?)',
        [String(userId), String(targetUser.id)]
      );
      conversationId = result.insertId;
    }

    res.status(HTTP_STATUS.CREATED).json({
      code: RESPONSE_CODES.SUCCESS,
      message: '会话创建成功',
      data: {
        conversationId,
        targetUser
      }
    });
  } catch (error) {
    console.error('创建私信会话失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const offset = (page - 1) * limit;

    const conversation = await getConversationForUser(conversationId, userId);
    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '会话不存在'
      });
    }

    const [rows] = await pool.execute(
      `SELECT pm.id,
              pm.conversation_id,
              pm.sender_id,
              pm.receiver_id,
              pm.content,
              pm.is_read,
              pm.created_at,
              su.user_id AS sender_user_id,
              su.nickname AS sender_nickname,
              su.avatar AS sender_avatar,
              su.verified AS sender_verified
       FROM private_messages pm
       JOIN users su ON su.id = pm.sender_id
       WHERE pm.conversation_id = ?
       ORDER BY pm.id ASC
       LIMIT ? OFFSET ?`,
      [String(conversationId), String(limit), String(offset)]
    );

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) AS total FROM private_messages WHERE conversation_id = ?',
      [String(conversationId)]
    );

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        messages: rows,
        pagination: {
          page,
          limit,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取私信消息失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

router.post('/conversations/:conversationId/messages', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { content } = req.body;
    const trimmedContent = (content || '').trim();

    if (!trimmedContent) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '消息内容不能为空'
      });
    }

    if (trimmedContent.length > 1000) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '消息内容不能超过1000字符'
      });
    }

    const [conversationRows] = await connection.execute(
      `SELECT id, user1_id, user2_id
       FROM private_conversations
       WHERE id = ? AND (user1_id = ? OR user2_id = ?)
       LIMIT 1`,
      [String(conversationId), String(userId), String(userId)]
    );

    if (conversationRows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '会话不存在'
      });
    }

    const conversation = conversationRows[0];
    const receiverId = Number(conversation.user1_id) === Number(userId)
      ? conversation.user2_id
      : conversation.user1_id;

    await connection.beginTransaction();

    const [insertResult] = await connection.execute(
      `INSERT INTO private_messages (conversation_id, sender_id, receiver_id, content)
       VALUES (?, ?, ?, ?)`,
      [String(conversationId), String(userId), String(receiverId), trimmedContent]
    );

    await connection.execute(
      `UPDATE private_conversations
       SET last_message_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [String(insertResult.insertId), String(conversationId)]
    );

    await connection.commit();

    const [messageRows] = await pool.execute(
      `SELECT pm.id,
              pm.conversation_id,
              pm.sender_id,
              pm.receiver_id,
              pm.content,
              pm.is_read,
              pm.created_at,
              su.user_id AS sender_user_id,
              su.nickname AS sender_nickname,
              su.avatar AS sender_avatar,
              su.verified AS sender_verified
       FROM private_messages pm
       JOIN users su ON su.id = pm.sender_id
       WHERE pm.id = ?
       LIMIT 1`,
      [String(insertResult.insertId)]
    );

    res.status(HTTP_STATUS.CREATED).json({
      code: RESPONSE_CODES.SUCCESS,
      message: '发送成功',
      data: messageRows[0]
    });
  } catch (error) {
    await connection.rollback();
    console.error('发送私信失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  } finally {
    connection.release();
  }
});

router.put('/conversations/:conversationId/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const conversation = await getConversationForUser(conversationId, userId);
    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '会话不存在'
      });
    }

    const [result] = await pool.execute(
      `UPDATE private_messages
       SET is_read = 1
       WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0`,
      [String(conversationId), String(userId)]
    );

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: '标记成功',
      data: {
        affected: result.affectedRows
      }
    });
  } catch (error) {
    console.error('标记私信已读失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS count FROM private_messages WHERE receiver_id = ? AND is_read = 0',
      [String(userId)]
    );

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        count: rows[0].count
      }
    });
  } catch (error) {
    console.error('获取私信未读数量失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

module.exports = router;