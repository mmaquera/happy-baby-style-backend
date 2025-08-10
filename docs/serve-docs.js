#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const DOCS_DIR = __dirname;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  // Parse URL
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  // Default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Get file path
  const filePath = path.join(DOCS_DIR, pathname);
  const extname = path.extname(filePath).toLowerCase();

  // Set content type
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  // Read file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>404 - Not Found</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #e74c3c; font-size: 72px; margin-bottom: 20px; }
              .message { color: #7f8c8d; font-size: 18px; }
              .link { color: #3498db; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="error">404</div>
            <div class="message">Page not found</div>
            <a href="/" class="link">Go back to documentation</a>
          </body>
          </html>
        `);
      } else {
        // Server error
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>500 - Server Error</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #e74c3c; font-size: 72px; margin-bottom: 20px; }
              .message { color: #7f8c8d; font-size: 18px; }
            </style>
          </head>
          <body>
            <div class="error">500</div>
            <div class="message">Internal server error</div>
          </body>
          </html>
        `);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`
🚀 Happy Baby Style API Documentation Server

📖 Documentation: http://localhost:${PORT}
📁 Directory: ${DOCS_DIR}
🔧 Port: ${PORT}

✨ Features:
   • Static file serving
   • MIME type support
   • Error handling
   • Clean 404 pages

Press Ctrl+C to stop the server
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down documentation server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down documentation server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}); 