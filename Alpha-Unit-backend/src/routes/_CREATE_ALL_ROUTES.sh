#!/bin/bash

# Create all route files following the same pattern

for route in personnel incidents shifts patrol cctv drones inventory billing notifications portal users dashboard reports; do
  controllerName="${route}Controller"
  fileName="${route}Routes.js"
  
  cat > "$fileName" << EOF
const express = require('express');
const router = express.Router();
const ${route}Controller = require('../controllers/${controllerName}');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET routes (accessible by authenticated users)
router.get('/', ${route}Controller.getAll || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/stats', ${route}Controller.getStats || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/:id', ${route}Controller.getById || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

// POST/PUT/DELETE routes (Admin or Operations Manager only)
router.post('/', authorize('Admin', 'Operations Manager'), ${route}Controller.create || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.put('/:id', authorize('Admin', 'Operations Manager'), ${route}Controller.update || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.delete('/:id', authorize('Admin'), ${route}Controller.deleteItem || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

module.exports = router;
EOF

  echo "Created $fileName"
done

echo "All route files created!"
