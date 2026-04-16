import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authMiddleware } from '../../infra/auth.js';
import { config } from '../../infra/config.js';
import { success } from '../../infra/response.js';
import { AppError } from '../../infra/error-handler.js';

// Ensure uploads directory exists
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter: only accept images
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, 'UPLOAD_INVALID_FILE_TYPE', '仅支持 JPEG、PNG、GIF、WebP 格式的图片'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

export function createUploadController(): Router {
  const router = Router();

  // POST /api/upload/avatar
  router.post(
    '/upload/avatar',
    authMiddleware,
    upload.single('avatar'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          throw new AppError(400, 'UPLOAD_NO_FILE', '请选择要上传的图片');
        }

        // Build the public URL for the uploaded file
        const relativePath = `/api/uploads/avatars/${req.file.filename}`;
        const avatarUrl = config.publicUrl ? `${config.publicUrl}${relativePath}` : relativePath;

        success(res, { avatarUrl });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
