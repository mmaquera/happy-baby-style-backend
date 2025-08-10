import { IStorageService } from '../../domain/interfaces/IStorageService';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

export class LocalStorageService implements IStorageService {
  private readonly baseUrl: string;
  private readonly uploadDir: string;

  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists(): Promise<void> {
    try {
      await stat(this.uploadDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await mkdir(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder?: string
  ): Promise<string> {
    try {
      // Create subfolder if specified
      const targetDir = folder 
        ? path.join(this.uploadDir, folder)
        : this.uploadDir;

      if (folder) {
        try {
          await stat(targetDir);
        } catch (error) {
          await mkdir(targetDir, { recursive: true });
        }
      }

      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(fileName) || this.getExtensionFromMimeType(mimeType);
      const baseName = path.basename(fileName, path.extname(fileName));
      const uniqueFileName = `${baseName}_${timestamp}${ext}`;

      const filePath = path.join(targetDir, uniqueFileName);
      
      // Write file
      await writeFile(filePath, buffer);

      // Return public URL
      const relativePath = folder 
        ? `uploads/${folder}/${uniqueFileName}`
        : `uploads/${uniqueFileName}`;
        
      return `${this.baseUrl}/${relativePath}`;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract relative path from URL
      const url = new URL(fileUrl);
      const relativePath = url.pathname.substring(1); // Remove leading '/'
      const filePath = path.join(process.cwd(), relativePath);

      // Check if file exists and delete
      try {
        await stat(filePath);
        await unlink(filePath);
      } catch (error) {
        // File doesn't exist, that's okay
        console.warn(`File not found for deletion: ${filePath}`);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getPublicUrl(fileName: string, folder?: string): string {
    const relativePath = folder 
      ? `uploads/${folder}/${fileName}`
      : `uploads/${fileName}`;
      
    return `${this.baseUrl}/${relativePath}`;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'text/plain': '.txt',
      'application/pdf': '.pdf',
      'application/json': '.json'
    };

    return mimeToExt[mimeType] || '.bin';
  }
}