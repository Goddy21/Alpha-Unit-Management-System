// src/routes/personnelRoutes.js
const express = require('express');
const router = express.Router();
const personnelController = require('../controllers/personnelController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET routes (accessible by authenticated users)
router.get('/stats', personnelController.getStats);
router.get('/', personnelController.getAll);
router.get('/:id', personnelController.getById);
router.get('/:id/certifications', personnelController.getCertifications);

// POST/PUT/DELETE routes (Admin or Operations Manager only)
router.post('/', authorize('Admin', 'Operations Manager'), personnelController.create);
router.post('/:id/certifications', authorize('Admin', 'Operations Manager'), personnelController.addCertification);
router.put('/:id', authorize('Admin', 'Operations Manager'), personnelController.update);
router.delete('/:id', authorize('Admin'), personnelController.deleteItem);

module.exports = router;