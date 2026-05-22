# Static Files Configuration Guide

## Overview
This document describes how static file serving (images) is configured for the Legioners.uz backend.

## Current Configuration

### Express Static Middleware
Located in `index.js`:

```javascript
const path = require('path');
const UPLOADS_PATH = path.join(process.cwd(), 'uploads');

// Static serving
app.use('/uploads', express.static(UPLOADS_PATH, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
}));
```

### Image URL Format
- Stored in DB: `filename.jpg` (just the filename)
- API Response: `/uploads/filename.jpg` (relative URL)
- Frontend Usage: `window.location.origin + response.coverImage`

## Nginx Configuration Notes

If using nginx as reverse proxy, ensure the following:

### Option 1: Nginx Serves Static Files Directly (Recommended)

```nginx
server {
    server_name legioners.uz api.legioners.uz;
    
    # API requests to Node.js
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static files - serve directly from uploads directory
    location /uploads/ {
        alias /path/to/your/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
    
    # Frontend static files
    location / {
        root /path/to/your/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

### Option 2: Nginx Proxies Static Files to Node.js

```nginx
server {
    server_name legioners.uz api.legioners.uz;
    
    location / {
        proxy_pass http://localhost:3000;
        # ... other proxy settings
    }
    
    # Cache static files aggressively
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:3000;
    }
}
```

## Testing Locally

```bash
# Start server
node index.js

# Test image access
curl http://localhost:3000/uploads/test.jpg

# Expected: Returns the image file or 404 if not found
```

## Troubleshooting

### 404 on Images
1. Check uploads directory exists: `ls -la uploads/`
2. Verify file permissions: `chmod 755 uploads/`
3. Check server logs for static file errors

### CORS Errors
- Static files have `Cross-Origin-Resource-Policy: cross-origin` header
- This allows images to be loaded from any origin

### Production Issues
1. Ensure uploads directory is shared across all Node.js instances
2. Use shared storage (NFS, S3) for multi-server setups
3. Consider using a CDN for images

## Environment Variables

For production, you may want to set:
- `PORT` - Server port (default: 3000)
- `UPLOADS_PATH` - Custom uploads directory path

## Security Notes

- Express static middleware serves files from the configured directory
- File extensions are validated by the file system
- No directory traversal vulnerabilities (Express handles this)
- Consider adding file type validation for uploads
