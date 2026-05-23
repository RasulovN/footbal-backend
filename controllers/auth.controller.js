const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const pool = require('../lib/db');
const Joi = require('joi');
const { mapBodyToDb } = require('../lib/utils');

// Email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: false,
  auth: {
    user: 'nurbekrasulov71@gmail.com',
    pass: 'uauq pwdu otsm ajeh',
  },
});

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(6).required(),
});

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, 'your_jwt_secret_key', { expiresIn: '7d' });
};

// Register new user
const register = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, password } = value;

    // Check if user exists
    const existingQuery = 'SELECT id FROM users WHERE email = $1';
    const existing = await pool.query(existingQuery, [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate ID
    const id = 'user-' + Date.now();

    // Insert user (timestamps handled by database defaults)
    const insertQuery = `
      INSERT INTO users (id, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, role
    `;
    const result = await pool.query(insertQuery, [id, email, hashedPassword, 'user']);

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Login with email and password
const login = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, password } = req.body;

    const query = 'SELECT id, email, password, role FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials user not found' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials password incorrect' });
    }

    const token = generateToken(user.id, user.role);
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Forgot password - send reset link
const forgotPassword = async (req, res) => {
  try {
    const { error } = forgotPasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email } = req.body;

    const query = 'SELECT id FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    const updateQuery = 'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3';
    await pool.query(updateQuery, [resetToken, resetExpires, user.id]);

    // Send reset email
    const resetLink = `https://legioners.uz/reset-password?token=${resetToken}`;
    console.log('Password reset link:', resetLink);

    const html = `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;

    try {
      await transporter.sendMail({
        from: 'noreply@legioners.uz',
        to: email,
        subject: 'Password Reset Request',
        html,
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify reset token
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const query = 'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > $2';
    const result = await pool.query(query, [token, new Date()]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    res.json({ message: 'Token is valid' });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { error } = resetPasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { token, password } = req.body;

    const selectQuery = 'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > $2';
    const selectResult = await pool.query(selectQuery, [token, new Date()]);

    if (selectResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const userId = selectResult.rows[0].id;
    const hashedPassword = await bcrypt.hash(password, 10);

    const updateQuery = 'UPDATE users SET password = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2';
    await pool.query(updateQuery, [hashedPassword, userId]);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update password
const updatePassword = async (req, res) => {
  try {
    const { error } = updatePasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const selectQuery = 'SELECT password FROM users WHERE id = $1';
    const selectResult = await pool.query(selectQuery, [userId]);
    const user = selectResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateQuery = 'UPDATE users SET password = $1 WHERE id = $2';
    await pool.query(updateQuery, [hashedPassword, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const query = 'SELECT id, email FROM users WHERE id = $1';
    const result = await pool.query(query, [req.user.id]);
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Logout
const logout = async (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  updatePassword,
};
