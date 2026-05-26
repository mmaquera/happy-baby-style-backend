import express, { Request, Response, NextFunction } from 'express';
import * as path from 'path';

export class StaticFileMiddleware {
  static setup(app: express.Application): void {
    // Serve uploaded files statically
    const uploadsPath = path.join(process.cwd(), 'uploads');

    app.use(
      '/uploads',
      express.static(uploadsPath, {
        maxAge: '1d', // Cache for 1 day
        etag: true,
        lastModified: true,
        setHeaders: (res: Response, path: string) => {
          // Set proper MIME types
          if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
          } else if (path.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
          } else if (path.endsWith('.gif')) {
            res.setHeader('Content-Type', 'image/gif');
          } else if (path.endsWith('.webp')) {
            res.setHeader('Content-Type', 'image/webp');
          } else if (path.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
          }

          // Set CORS headers for cross-origin access
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        },
      }),
    );

    // Health check endpoint for uploads directory
    app.get('/uploads/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        uploadsDirectory: uploadsPath,
        timestamp: new Date().toISOString(),
      });
    });
  }
}
