const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { getMe, getProfile, addFavorite, removeFavorite, getFavorites, createUser, getAllUsers } = require('../controllers/user.controller');

const router = express.Router();

// Get current user info
router.get('/me', authenticate, getMe);

// Get user profile
router.get('/profile', authenticate, getProfile);

// Favorites
router.get('/saved-articles', authenticate, getFavorites);
router.post('/saved-articles/:articleId', authenticate, addFavorite);
router.delete('/saved-articles/:articleId', authenticate, removeFavorite);

// Admin routes
router.post('/users', authenticate, createUser);
router.get('/users', authenticate, getAllUsers);

module.exports = router;
