const pool = require('../lib/db');
const Joi = require('joi');
const { mapBodyToDb, keysToCamel } = require('../lib/utils');

// Validation schemas (camelCase for API)
const categorySchema = Joi.object({
  nameUz: Joi.string().required(),
  nameRu: Joi.string().required(),
  slug: Joi.string().required(),
});

// Get all categories
const getCategories = async (req, res) => {
  try {
    const query = `
      SELECT id, name_uz, name_ru, slug, created_at, updated_at 
      FROM categories 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    
    // Convert snake_case to camelCase for response
    const formatted = result.rows.map(row => keysToCamel(row));
    res.json(formatted);
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
      SELECT c.id, c.name_uz, c.name_ru, c.slug, c.created_at, c.updated_at,
             json_agg(a.*) as articles
      FROM categories c
      LEFT JOIN articles a ON c.id = a.category_id
      WHERE c.id = $1
      GROUP BY c.id
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });

    const category = keysToCamel(result.rows[0]);
    category.articles = category.articles ? category.articles.filter(a => a !== null) : [];
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

    // Map camelCase to snake_case
    const data = mapBodyToDb(value, ['nameUz', 'nameRu', 'slug']);
    
    // Generate ID
    const id = 'cat-' + Date.now();
    data.id = id;

    const insertQuery = `
      INSERT INTO categories (id, name_uz, name_ru, slug)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [id, data.name_uz, data.name_ru, data.slug]);

    res.status(201).json(keysToCamel(result.rows[0]));
  } catch (error) {
    console.error('Create category error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Category slug already exists' });
    }
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = categorySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Map camelCase to snake_case
    const data = mapBodyToDb(value, ['nameUz', 'nameRu', 'slug']);

    const updateQuery = `
      UPDATE categories 
      SET name_uz = $1, name_ru = $2, slug = $3
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [data.name_uz, data.name_ru, data.slug, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(keysToCamel(result.rows[0]));
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
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete category with existing articles' });
    }
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
