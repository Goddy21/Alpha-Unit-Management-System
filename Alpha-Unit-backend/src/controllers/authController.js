const { query, transaction } = require('../config/database');
const {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generatePasswordResetToken,
} = require('../utils/auth');
const { v4: uuidv4 } = require('uuid');

/**
 * Register a new user
 */
const register = async (req, res) => {
  try {
    const { name, email, password, phone, role, department } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and role.',
      });
    }

    // Check if user already exists
    const existingUser = await query('SELECT * FROM users WHERE email = $1', [
      email,
    ]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.',
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await query(
      `INSERT INTO users (name, email, password_hash, phone, role, department, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, phone, role, department, status, created_at`,
      [name, email, passwordHash, phone || null, role, department || null, 'active']
    );

    const user = result.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Save refresh token
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
      [user.id, refreshToken]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          department: user.department,
          status: user.status,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user.',
      error: error.message,
    });
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.',
      });
    }

    // Get user from database
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended or inactive. Please contact administrator.',
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Update last active
    await query('UPDATE users SET last_active = NOW() WHERE id = $1', [user.id]);

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Save refresh token
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
      [user.id, refreshToken]
    );

    // Get user permissions
    const permissionsResult = await query(
      'SELECT permission_name FROM user_permissions WHERE user_id = $1',
      [user.id]
    );
    const permissions = permissionsResult.rows.map((row) => row.permission_name);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          department: user.department,
          status: user.status,
          permissions,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in.',
      error: error.message,
    });
  }
};

/**
 * Refresh access token
 */
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Check if refresh token exists in database
    const result = await query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()',
      [refreshToken, decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.',
      });
    }

    // Get user
    const userResult = await query(
      'SELECT id, name, email, role FROM users WHERE id = $1 AND status = $2',
      [decoded.userId, 'active']
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive.',
      });
    }

    const user = userResult.rows[0];

    // Generate new access token
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully.',
      data: {
        accessToken,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token.',
    });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Delete refresh token from database
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful.',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging out.',
    });
  }
};

/**
 * Request password reset
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
      });
    }

    // Get user
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      // Don't reveal that user doesn't exist
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = generatePasswordResetToken();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token
    await query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );

    // TODO: Send email with reset link
    // const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    // await sendPasswordResetEmail(user.email, resetUrl);

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      // In development, return the token (remove in production)
      ...(process.env.NODE_ENV === 'development' && { resetToken }),
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error requesting password reset.',
    });
  }
};

/**
 * Reset password
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required.',
      });
    }

    // Find user with valid reset token
    const result = await query(
      'SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token.',
      });
    }

    const user = result.rows[0];

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await query(
      'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    // Delete all refresh tokens for this user (force re-login)
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password.',
    });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, name, email, phone, role, department, status, last_active, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Get permissions
    const permissionsResult = await query(
      'SELECT permission_name FROM user_permissions WHERE user_id = $1',
      [userId]
    );
    const permissions = permissionsResult.rows.map((row) => row.permission_name);

    res.status(200).json({
      success: true,
      data: {
        user: result.rows[0],
        permissions,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile.',
    });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, department } = req.body;

    const result = await query(
      `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), 
       department = COALESCE($3, department) WHERE id = $4
       RETURNING id, name, email, phone, role, department, status`,
      [name, phone, department, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile.',
    });
  }
};

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  requestPasswordReset,
  resetPassword,
  getProfile,
  updateProfile,
};
