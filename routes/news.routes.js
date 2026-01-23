const express = require('express');
const multer = require('multer');
const path = require('path');
const { getArticles, getArticle, getRelatedArticles, getUserArticles, getArticleForEdit, createArticle, updateArticle, deleteArticle } = require('../controllers/news.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Public routes
router.get('/', getArticles);
router.get('/:id/related', getRelatedArticles);

// Protected routes
router.get('/user', authenticate, getUserArticles);
router.get('/:id/edit', authenticate, getArticleForEdit);
router.post('/', authenticate, upload.single('coverImage'), createArticle);
router.put('/:id', authenticate, upload.single('coverImage'), updateArticle);
router.delete('/:id', authenticate, deleteArticle);

// Public routes (parameterized routes should be last)
router.get('/:id', getArticle);

module.exports = router;