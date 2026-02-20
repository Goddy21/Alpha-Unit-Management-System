const express = require('express');
const router = express.Router();
const incidentsController = require('../controllers/incidentsController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET routes (accessible by authenticated users)
router.get('/', incidentsController.getAll || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/stats', incidentsController.getStats || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/:id', incidentsController.getById || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

// POST/PUT/DELETE routes (Admin or Operations Manager only)
router.post('/', authorize('Admin', 'Operations Manager'), incidentsController.create || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.put('/:id', authorize('Admin', 'Operations Manager'), incidentsController.update || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.delete('/:id', authorize('Admin'), incidentsController.deleteItem || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

module.exports = router;
