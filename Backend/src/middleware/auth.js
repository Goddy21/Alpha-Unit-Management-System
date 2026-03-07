// src/middleware/auth.js
const { verifyAccessToken } = require('../utils/auth');
const { query } = require('../config/database');
const { ROLES, ROLE_PERMISSIONS, SENIOR_ROLES } = require('../config/roles');

/**
 * Authenticate user from JWT Bearer token.
 * Attaches `req.user` with id, name, email, role, status, effectivePermissions.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Fetch user + their custom DB permissions in one query
    const result = await query(
      `SELECT
         u.id, u.name, u.email, u.role, u.status, u.department,
         COALESCE(
           json_agg(up.permission_name) FILTER (WHERE up.permission_name IS NOT NULL),
           '[]'
         ) AS custom_permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Authorization denied.',
      });
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Access denied.',
      });
    }

    // Merge role-default permissions with any custom DB permissions
    const roleDefaults = ROLE_PERMISSIONS[user.role] || [];
    const customPerms  = Array.isArray(user.custom_permissions) ? user.custom_permissions : [];
    const merged       = Array.from(new Set([...roleDefaults, ...customPerms]));

    req.user = {
      id:                   user.id,
      name:                 user.name,
      email:                user.email,
      role:                 user.role,
      status:               user.status,
      department:           user.department,
      effectivePermissions: merged,
    };

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
 * Authorize by role name(s).
 * Senior roles (Admin, Managing Director) always pass.
 * Usage: authorize('HR Manager', 'Operations Manager')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // Senior roles bypass all role checks
    if (SENIOR_ROLES.includes(req.user.role)) return next();

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}.`,
        yourRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Authorize by granular permission key.
 * Senior roles always pass.
 * Usage: requirePermission('leave:approve')
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // Senior roles bypass permission checks
    if (SENIOR_ROLES.includes(req.user.role)) return next();

    if (!req.user.effectivePermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}.`,
      });
    }

    next();
  };
};

/**
 * Legacy alias kept for backwards compatibility.
 * Checks a single permission against user_permissions table (DB lookup).
 */
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (SENIOR_ROLES.includes(req.user?.role)) return next();

      const result = await query(
        'SELECT 1 FROM user_permissions WHERE user_id = $1 AND permission_name = $2',
        [req.user.id, permission]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You do not have this permission.',
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ success: false, message: 'Error checking permissions.' });
    }
  };
};

module.exports = { authenticate, authorize, requirePermission, checkPermission };
