// settingsRoutes.js
const express = require('express');
const router  = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Aggregated read — all settings for current user
router.get('/', settingsController.getAll);

// Per-section writes
router.put('/system',        authorize('Admin'), settingsController.updateSystem);
router.put('/notifications', settingsController.updateNotifications);
router.put('/appearance',    settingsController.updateAppearance);

// Sessions
router.get('/sessions',         settingsController.getSessions);
router.delete('/sessions',      settingsController.revokeAllSessions);
router.delete('/sessions/:id',  settingsController.revokeSession);

module.exports = router;