const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ── Named routes FIRST (before /:id swallows them) ───────────────────────────
router.get('/stats',   usersController.getStats);
router.get('/profile', usersController.getProfile);
router.put('/profile', usersController.updateProfile);
router.put('/password', usersController.changePassword);

// ── Generic /:id routes AFTER ─────────────────────────────────────────────────
router.get('/',    authorize('Admin'), usersController.getAll);
router.get('/:id', authorize('Admin'), usersController.getById);
router.post('/',   authorize('Admin'), usersController.create);
router.put('/:id',              authorize('Admin'), usersController.update);
router.put('/:id/status',       authorize('Admin'), usersController.updateStatus);
router.put('/:id/permissions',  authorize('Admin'), usersController.updatePermissions);
router.delete('/:id',           authorize('Admin'), usersController.deleteItem);

module.exports = router;