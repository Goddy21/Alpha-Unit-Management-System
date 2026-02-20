const express = require('express');
const router = express.Router();
const dronesController = require('../controllers/dronesController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET routes (accessible by authenticated users)
router.get('/', dronesController.getAll || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/stats', dronesController.getStats || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/:id', dronesController.getById || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

// POST/PUT/DELETE routes (Admin or Operations Manager only)
router.post('/', authorize('Admin', 'Operations Manager'), dronesController.create || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.put('/:id', authorize('Admin', 'Operations Manager'), dronesController.update || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.delete('/:id', authorize('Admin'), dronesController.deleteItem || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

module.exports = router;
