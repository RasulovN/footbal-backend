const express = require('express');
const { register, login, getMe, logout, forgotPassword, verifyResetToken, resetPassword, updatePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);
router.post('/update-password', authenticate, updatePassword);

module.exports = router;