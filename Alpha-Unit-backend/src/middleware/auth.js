const { verifyAccessToken } = require('../utils/auth');
const { query } = require('../config/database');

/**
 * Authenticate user from JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database
    const result = await query(
      'SELECT id, name, email, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Authorization denied.',
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Access denied.',
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Authorization denied.',
    });
  }
};

/**
 * Authorize based on user roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.',
      });
    }

    next();
  };
};

/**
 * Check specific permissions
 */
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const result = await query(
        'SELECT * FROM user_permissions WHERE user_id = $1 AND permission_name = $2',
        [req.user.id, permission]
      );

      if (result.rows.length === 0 && req.user.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have this permission.',
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions.',
      });
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  checkPermission,
};
