const express = require('express');
const { submitContact, getContacts } = require('../controllers/contact.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Public route
router.post('/', submitContact);

// Protected route
router.get('/', authenticate, getContacts);

module.exports = router;