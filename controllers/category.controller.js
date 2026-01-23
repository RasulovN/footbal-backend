const pool = require('../lib/db');
const Joi = require('joi');

// Validation schemas
const categorySchema = Joi.object({
  nameUz: Joi.string().required(),
  nameRu: Joi.string().required(),
  slug: Joi.string().required(),
});

// Get all categories
const getCategories = async (req, res) => {
  try {
    const query = 'SELECT id, "nameUz", "nameRu", slug, "createdAt", "updatedAt" FROM categories ORDER BY "createdAt" DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single category
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT c.id, c."nameUz", c."nameRu", c.slug, c."createdAt", c."updatedAt",
             json_agg(a.*) as articles
      FROM categories c
      LEFT JOIN articles a ON c.id = a."categoryId"
      WHERE c.id = $1
      GROUP BY c.id
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });

    const category = result.rows[0];
    category.articles = category.articles.filter(a => a !== null); // Remove nulls if no articles

    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create category
const createCategory = async (req, res) => {
  try {
    const { error, value } = categorySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const insertQuery = 'INSERT INTO categories ("nameUz", "nameRu", slug) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(insertQuery, [value.nameUz, value.nameRu, value.slug]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create category error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Category slug already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = categorySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const updateQuery = 'UPDATE categories SET "nameUz" = $1, "nameRu" = $2, slug = $3, "updatedAt" = NOW() WHERE id = $4 RETURNING *';
    const result = await pool.query(updateQuery, [value.nameUz, value.nameRu, value.slug, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update category error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Category slug already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleteQuery = 'DELETE FROM categories WHERE id = $1';
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
