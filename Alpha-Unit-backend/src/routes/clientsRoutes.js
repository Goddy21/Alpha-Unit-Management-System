const express = require('express');
const router = express.Router();
const clientsController = require('../controllers/clientsController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get clients stats (accessible by all authenticated users)
router.get('/stats', clientsController.getClientStats);

// Get all clients with pagination
router.get('/', clientsController.getClients);

// Get single client by ID
router.get('/:id', clientsController.getClientById);

// Create, update, delete require Admin or Operations Manager
router.post('/', authorize('Admin', 'Operations Manager'), clientsController.createClient);
router.put('/:id', authorize('Admin', 'Operations Manager'), clientsController.updateClient);
router.delete('/:id', authorize('Admin'), clientsController.deleteClient);

module.exports = router;
