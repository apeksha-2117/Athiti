import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const uploadRouter = Router();

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `proof-${uniqueSuffix}${cleanExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
    }
  },
});

// POST /api/upload
// Handles both multipart form-data (field "file" or "photo") AND base64 JSON payload
uploadRouter.post('/', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('multipart/form-data')) {
    upload.single('photo')(req, res, (err) => {
      if (err) {
        // Fallback to checking field "file"
        return upload.single('file')(req, res, (err2) => {
          if (err2) return res.status(400).json({ error: err2.message || 'Upload failed' });
          if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
          const url = `/uploads/${req.file.filename}`;
          return res.json({
            url,
            storageKey: url,
            filename: req.file.filename,
            contentType: req.file.mimetype,
            fileSize: req.file.size,
          });
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
      }

      const url = `/uploads/${req.file.filename}`;
      return res.json({
        url,
        storageKey: url,
        filename: req.file.filename,
        contentType: req.file.mimetype,
        fileSize: req.file.size,
      });
    });
  } else {
    // Base64 JSON fallback
    try {
      const { dataUrl, filename = 'capture.jpg' } = req.body || {};
      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'Missing image data' });
      }

      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: 'Invalid base64 data format' });
      }

      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const ext = mimeType.includes('png') ? '.png' : mimeType.includes('webp') ? '.webp' : '.jpg';
      const uniqueFilename = `proof-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = path.join(uploadsDir, uniqueFilename);

      fs.writeFileSync(filePath, buffer);

      const url = `/uploads/${uniqueFilename}`;
      return res.json({
        url,
        storageKey: url,
        filename: uniqueFilename,
        contentType: mimeType,
        fileSize: buffer.length,
      });
    } catch (err) {
      return next(err);
    }
  }
});
