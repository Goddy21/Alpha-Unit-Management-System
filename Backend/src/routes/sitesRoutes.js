const express = require('express');
const router = express.Router();
const sitesController = require('../controllers/sitesController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ── Named routes FIRST (before /:id) ─────────────────────────────────────────
router.get('/stats', sitesController.getStats);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/',     sitesController.getAll);
router.get('/:id',  sitesController.getById);
router.post('/',    authorize('Admin', 'Operations Manager'), sitesController.create);
router.put('/:id',  authorize('Admin', 'Operations Manager'), sitesController.update);
router.delete('/:id', authorize('Admin'), sitesController.deleteItem);

module.exports = router;