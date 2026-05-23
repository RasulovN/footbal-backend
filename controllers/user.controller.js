const Joi = require('joi');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../lib/db');
const { keysToCamel } = require('../lib/utils');

// Get current user info
const getMe = async (req, res) => {
  try {
    const query = 'SELECT id, email, role FROM users WHERE id = $1';
    const result = await pool.query(query, [req.user.id]);
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const query = 'SELECT id, email, created_at FROM users WHERE id = $1';
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json(keysToCamel(result.rows[0]));
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get saved articles
const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT a.* FROM favorites f
      JOIN articles a ON f.article_id = a.id
      WHERE f.user_id = $1
    `;
    const result = await pool.query(query, [userId]);

    res.json(result.rows.map(row => keysToCamel(row)));
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add favorite
const addFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { articleId } = req.params;

    // Generate ID
    const id = 'fav-' + Date.now();

    const insertQuery = 'INSERT INTO favorites (id, user_id, article_id) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(insertQuery, [id, userId, articleId]);

    res.status(201).json(keysToCamel(result.rows[0]));
  } catch (error) {
    console.error('Add favorite error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Article already saved' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove favorite
const removeFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { articleId } = req.params;

    const deleteQuery = 'DELETE FROM favorites WHERE user_id = $1 AND article_id = $2';
    await pool.query(deleteQuery, [userId, articleId]);

    res.json({ message: 'Article removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new user (authenticated users)
const createUser = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role || 'user';

    // Validate input
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      role: Joi.string().valid('user', 'admin').optional(),
    });
    const { error } = schema.validate({ email, password, role });
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Check if user exists
    const existingQuery = 'SELECT id FROM users WHERE lower(email) = $1';
    const existing = await pool.query(existingQuery, [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user (timestamps handled by database)
    const id = 'user-' + Date.now();
    const insertQuery = 'INSERT INTO users (id, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role';
    const result = await pool.query(insertQuery, [id, email, hashedPassword, role]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all users (authenticated users)
const getAllUsers = async (req, res) => {
  try {
    const query = 'SELECT id, email, role, created_at FROM users ORDER BY created_at DESC';
    const result = await pool.query(query);

    res.json(result.rows.map(row => keysToCamel(row)));
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Update user (authenticated users)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password ? String(req.body.password) : '';

    // Validate input
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).optional().allow(''),
    });
    const { error } = schema.validate({ email, password });
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Check if another user has this email
    const existingQuery = 'SELECT id FROM users WHERE lower(email) = $1 AND id != $2';
    const existing = await pool.query(existingQuery, [email, id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use by another user' });
    }

    if (password && password.length >= 6) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const updateQuery = 'UPDATE users SET email = $1, password = $2 WHERE id = $3 RETURNING id, email, created_at';
      const result = await pool.query(updateQuery, [email, hashedPassword, id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(keysToCamel(result.rows[0]));
    } else {
      const updateQuery = 'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, email, created_at';
      const result = await pool.query(updateQuery, [email, id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(keysToCamel(result.rows[0]));
    }
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete user (authenticated users)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const deleteQuery = 'DELETE FROM users WHERE id = $1';
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getMe,
  getProfile,
  getFavorites,
  addFavorite,
  removeFavorite,
  createUser,
  getAllUsers,
  updateUser,
  deleteUser,
};
