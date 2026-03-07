// src/routes/usersRoutes.js
const express = require('express');
const router  = express.Router();
const usersController = require('../controllers/usersController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

router.use(authenticate);

// ── Self-service (any authenticated user) ────────────────────────────────────
router.get('/stats',    usersController.getStats);
router.get('/profile',  usersController.getProfile);
router.put('/profile',  usersController.updateProfile);
router.put('/password', usersController.changePassword);

// ── User management (Admin, Managing Director, HR Manager) ──────────────────
const USER_MANAGERS = [ROLES.ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.HR_MANAGER];

router.get('/',    authorize(...USER_MANAGERS), usersController.getAll);
router.get('/:id', authorize(...USER_MANAGERS), usersController.getById);
router.post('/',   authorize(...USER_MANAGERS), usersController.create);
router.put('/:id',             authorize(...USER_MANAGERS), usersController.update);
router.put('/:id/status',      authorize(...USER_MANAGERS), usersController.updateStatus);
router.put('/:id/permissions', authorize(ROLES.ADMIN, ROLES.MANAGING_DIRECTOR), usersController.updatePermissions);
router.delete('/:id',          authorize(ROLES.ADMIN, ROLES.MANAGING_DIRECTOR), usersController.deleteItem);

module.exports = router;