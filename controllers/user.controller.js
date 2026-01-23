const Joi = require('joi');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../lib/db');

const adminEmail = 'nurbekrasulov711@gmail.com';

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
    const query = 'SELECT id, email, "createdAt" FROM users WHERE id = $1';
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json(result.rows[0]);
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
      JOIN articles a ON f."articleId" = a.id
      WHERE f."userId" = $1
    `;
    const result = await pool.query(query, [userId]);

    res.json(result.rows);
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

    const insertQuery = 'INSERT INTO favorites ("userId", "articleId") VALUES ($1, $2) RETURNING *';
    const result = await pool.query(insertQuery, [userId, articleId]);

    res.status(201).json(result.rows[0]);
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

    const deleteQuery = 'DELETE FROM favorites WHERE "userId" = $1 AND "articleId" = $2';
    await pool.query(deleteQuery, [userId, articleId]);

    res.json({ message: 'Article removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if user is admin
const isAdmin = async (userId) => {
  const query = 'SELECT email FROM users WHERE id = $1';
  const result = await pool.query(query, [userId]);
  return result.rows.length > 0 && result.rows[0].email === adminEmail;
};

// Create new user (admin only)
const createUser = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { email, password } = req.body;

    // Validate input
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
    });
    const { error } = schema.validate({ email, password });
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Check if user exists
    const existingQuery = 'SELECT id FROM users WHERE email = $1';
    const existing = await pool.query(existingQuery, [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const id = 'user-' + Date.now();
    const insertQuery = 'INSERT INTO users (id, email, password, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id, email, "createdAt"';
    const result = await pool.query(insertQuery, [id, email, hashedPassword]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const query = 'SELECT id, email, "createdAt" FROM users ORDER BY "createdAt" DESC';
    const result = await pool.query(query);

    res.json(result.rows);
  } catch (error) {
    console.error('Get all users error:', error);
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
};
