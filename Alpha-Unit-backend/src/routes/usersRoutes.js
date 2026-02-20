// src/routes/usersRoutes.js
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET routes (accessible by authenticated users)
router.get('/stats', usersController.getStats);
router.get('/', usersController.getAll);
router.get('/:id', usersController.getById);

// POST/PUT/DELETE routes (Admin only)
router.post('/', authorize('Admin'), usersController.create);
router.put('/:id', authorize('Admin'), usersController.update);
router.put('/:id/status', authorize('Admin'), usersController.updateStatus);
router.put('/:id/permissions', authorize('Admin'), usersController.updatePermissions);
router.delete('/:id', authorize('Admin'), usersController.deleteItem);

module.exports = router;