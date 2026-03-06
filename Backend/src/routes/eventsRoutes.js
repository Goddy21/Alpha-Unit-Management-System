const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Stats first (before /:id)
router.get('/stats', eventsController.getStats);

// CRUD
router.get('/',     eventsController.getAll);
router.post('/',    eventsController.create);
router.get('/:id',  eventsController.getById);
router.put('/:id',  eventsController.update);
router.delete('/:id', eventsController.deleteEvent);

module.exports = router;
