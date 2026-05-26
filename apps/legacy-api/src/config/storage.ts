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
    'text/plain',
  ],
  // SVG specific configuration
  svgConfig: {
    maxFileSize: parseInt(process.env.SVG_MAX_FILE_SIZE || '2097152'), // 2MB
    allowedMimeTypes: ['image/svg+xml', 'application/svg+xml'],
    allowedExtensions: ['.svg'],
    maxContentSize: parseInt(process.env.SVG_MAX_CONTENT_SIZE || '1048576'), // 1MB
    enableSanitization: process.env.SVG_ENABLE_SANITIZATION !== 'false', // Default true
    enableOptimization: process.env.SVG_ENABLE_OPTIMIZATION !== 'false', // Default true
  },
} as const;
