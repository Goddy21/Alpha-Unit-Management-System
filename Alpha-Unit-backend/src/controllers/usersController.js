// src/controllers/usersController.js
const { query, transaction } = require('../config/database');
const { hashPassword } = require('../utils/auth');

/**
 * Get all users with pagination and filters
 */
const getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (search) {
      whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR CAST(u.id AS TEXT) ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role && role !== 'all') {
      whereConditions.push(`u.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (status && status !== 'all') {
      whereConditions.push(`u.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Get users with permissions
    const usersQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.status,
        u.department,
        u.last_active,
        u.created_at,
        COALESCE(
          json_agg(
            DISTINCT up.permission_name
          ) FILTER (WHERE up.permission_name IS NOT NULL),
          '[]'
        ) as permissions
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const usersResult = await query(usersQuery, params);

    // Format last_active
    const users = usersResult.rows.map(user => ({
      ...user,
      lastActive: formatLastActive(user.last_active),
      createdAt: user.created_at
      ? user.created_at.toISOString().split('T')[0]
      : null,
    }));

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const countParams = whereConditions.length > 0
      ? params.slice(0, paramIndex - 2)
      : [];

    const countResult = await query(countQuery, countParams);

    const total = parseInt(countResult.rows[0].total);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users.',
      error: error.message,
    });
  }
};

/**
 * Get user by ID
 */
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const userQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.status,
        u.department,
        u.last_active,
        u.created_at,
        u.email_verified,
        u.two_factor_enabled,
        COALESCE(
          json_agg(
            DISTINCT up.permission_name
          ) FILTER (WHERE up.permission_name IS NOT NULL),
          '[]'
        ) as permissions
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const result = await query(userQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const user = result.rows[0];
    user.lastActive = formatLastActive(user.last_active);
    user.createdAt = user.created_at
    ? user.created_at.toISOString().split('T')[0]
    : null;

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user.',
      error: error.message,
    });
  }
};

/**
 * Create new user
 */
const create = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      department,
      status = 'active',
      permissions = [],
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required.',
      });
    }

    // Check if user already exists
    const existingUser = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.',
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    const result = await transaction(async (client) => {
      // Create user
      const userResult = await client.query(
        `INSERT INTO users (name, email, password_hash, phone, role, department, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, email, phone, role, department, status, created_at`,
        [name, email, passwordHash, phone || null, role, department || null, status]
      );

      const newUser = userResult.rows[0];

      // Add permissions
      if (permissions.length > 0) {
        for (const permission of permissions) {
          await client.query(
            'INSERT INTO user_permissions (user_id, permission_name) VALUES ($1, $2)',
            [newUser.id, permission]
          );
        }
      }

      // Get user with permissions
      const userWithPerms = await client.query(
        `SELECT 
          u.*,
          COALESCE(
            json_agg(up.permission_name) FILTER (WHERE up.permission_name IS NOT NULL),
            '[]'
          ) as permissions
         FROM users u
         LEFT JOIN user_permissions up ON u.id = up.user_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [newUser.id]
      );

      return userWithPerms.rows[0];
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: result,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user.',
      error: error.message,
    });
  }
};

/**
 * Update user
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      role,
      department,
      status,
      permissions,
    } = req.body;

    const result = await transaction(async (client) => {
      // Update user basic info
      const userResult = await client.query(
        `UPDATE users SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          role = COALESCE($3, role),
          department = COALESCE($4, department),
          status = COALESCE($5, status)
         WHERE id = $6
         RETURNING id, name, email, phone, role, department, status, created_at`,
        [name, phone, role, department, status, id]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const updatedUser = userResult.rows[0];

      // Update permissions if provided
      if (permissions && Array.isArray(permissions)) {
        // Delete existing permissions
        await client.query('DELETE FROM user_permissions WHERE user_id = $1', [id]);

        // Add new permissions
        for (const permission of permissions) {
          await client.query(
            'INSERT INTO user_permissions (user_id, permission_name) VALUES ($1, $2)',
            [id, permission]
          );
        }
      }

      // Get user with permissions
      const userWithPerms = await client.query(
        `SELECT 
          u.*,
          COALESCE(
            json_agg(up.permission_name) FILTER (WHERE up.permission_name IS NOT NULL),
            '[]'
          ) as permissions
         FROM users u
         LEFT JOIN user_permissions up ON u.id = up.user_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [id]
      );

      return userWithPerms.rows[0];
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data: result,
    });
  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating user.',
      error: error.message,
    });
  }
};

/**
 * Delete user
 */
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.',
      });
    }

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully.',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user.',
      error: error.message,
    });
  }
};

/**
 * Get user statistics
 */
const getStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended,
        COUNT(CASE WHEN role = 'Admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'Operations Manager' THEN 1 END) as managers,
        COUNT(CASE WHEN role = 'Guard' THEN 1 END) as guards,
        COUNT(CASE WHEN role = 'Client' THEN 1 END) as clients
      FROM users
    `;

    const result = await query(statsQuery);

    res.status(200).json({
      success: true,
      data: {
        total: parseInt(result.rows[0].total),
        active: parseInt(result.rows[0].active),
        inactive: parseInt(result.rows[0].inactive),
        suspended: parseInt(result.rows[0].suspended),
        admins: parseInt(result.rows[0].admins),
        managers: parseInt(result.rows[0].managers),
        guards: parseInt(result.rows[0].guards),
        clients: parseInt(result.rows[0].clients),
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics.',
      error: error.message,
    });
  }
};

/**
 * Update user status (activate/suspend)
 */
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active, inactive, or suspended.',
      });
    }

    const result = await query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, email, status',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: `User ${status === 'active' ? 'activated' : status === 'suspended' ? 'suspended' : 'deactivated'} successfully.`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user status.',
      error: error.message,
    });
  }
};

/**
 * Update user permissions
 */
const updatePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Permissions must be an array.',
      });
    }

    await transaction(async (client) => {
      // Delete existing permissions
      await client.query('DELETE FROM user_permissions WHERE user_id = $1', [id]);

      // Add new permissions
      for (const permission of permissions) {
        await client.query(
          'INSERT INTO user_permissions (user_id, permission_name) VALUES ($1, $2)',
          [id, permission]
        );
      }
    });

    res.status(200).json({
      success: true,
      message: 'Permissions updated successfully.',
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating permissions.',
      error: error.message,
    });
  }
};

// Helper function to format last active time
function formatLastActive(lastActive) {
  if (!lastActive) return 'Never';

  const now = new Date();
  const active = new Date(lastActive);
  const diffMs = now - active;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return active.toLocaleDateString();
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteItem,
  getStats,
  updateStatus,
  updatePermissions,
};