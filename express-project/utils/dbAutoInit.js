/**
 * 数据库自动初始化检查模块
 * 在应用启动时自动检测数据库是否初始化，未初始化则自动执行
 */
const { pool } = require('../config/config');
const DatabaseInitializer = require('../scripts/init-database');

async function checkAndInitDatabase() {
  let connection;
  try {
    console.log('检查数据库初始化状态...');
    
    // 尝试获取连接
    connection = await pool.getConnection();
    
    // 检查关键表是否存在（检查users表）
    const [tables] = await connection.execute(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = 'users'`,
      [process.env.DB_NAME || 'xiaoshiliu']
    );
    
    if (tables[0].count === 0) {
      console.log('数据库未初始化，开始自动初始化...\n');
      
      // 释放当前连接
      connection.release();
      connection = null;
      
      // 执行数据库初始化
      const initializer = new DatabaseInitializer();
      await initializer.run();
      
      console.log('数据库自动初始化完成！\n');
      return true;
    } else {
      console.log('数据库已初始化，跳过初始化步骤\n');
      return false;
    }
  } catch (error) {
    console.warn('数据库检查失败，可能数据库尚未创建:', error.message);
    console.log('尝试执行完整初始化...\n');
    
    // 释放可能存在的连接
    if (connection) {
      connection.release();
      connection = null;
    }
    
    try {
      // 执行数据库初始化（包括创建数据库）
      const initializer = new DatabaseInitializer();
      await initializer.run();
      
      console.log('数据库自动初始化完成！\n');
      return true;
    } catch (initError) {
      console.error('数据库初始化失败:', initError.message);
      console.error('请检查数据库连接配置或手动运行: node scripts/init-database.js');
      throw initError;
    }
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { checkAndInitDatabase };
