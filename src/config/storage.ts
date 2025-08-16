export const storageConfig = {
  baseUrl: process.env.STORAGE_BASE_URL || 'http://localhost:3000',
  uploadDir: process.env.STORAGE_UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE || '10485760'), // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain'
  ]
} as const;
