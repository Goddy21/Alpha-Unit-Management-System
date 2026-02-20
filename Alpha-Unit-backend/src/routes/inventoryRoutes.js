const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET routes (accessible by authenticated users)
router.get('/', inventoryController.getAll || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/stats', inventoryController.getStats || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/:id', inventoryController.getById || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

// POST/PUT/DELETE routes (Admin or Operations Manager only)
router.post('/', authorize('Admin', 'Operations Manager'), inventoryController.create || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.put('/:id', authorize('Admin', 'Operations Manager'), inventoryController.update || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.delete('/:id', authorize('Admin'), inventoryController.deleteItem || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

module.exports = router;
