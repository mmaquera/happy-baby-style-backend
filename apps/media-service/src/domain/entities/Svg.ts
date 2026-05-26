import crypto from 'crypto';

export interface Svg {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  bucket: string;
  path: string;
  entityType: SvgEntityType;
  entityId: string;
  createdAt: Date;
  dimensions?: {
    width?: number;
    height?: number;
  };
  viewBox?: string;
  optimized: boolean;
}

export enum SvgEntityType {
  PRODUCT = 'product',
  USER = 'user',
  CATEGORY = 'category',
  ICON = 'icon',
  LOGO = 'logo'
}

export class SvgEntity implements Svg {
  constructor(
    public readonly id: string,
    public readonly fileName: string,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly url: string,
    public readonly bucket: string,
    public readonly path: string,
    public readonly entityType: SvgEntityType,
    public readonly entityId: string,
    public readonly createdAt: Date,
    public readonly dimensions?: { width?: number; height?: number },
    public readonly viewBox?: string,
    public readonly optimized: boolean = false
  ) {}

  static create(data: Omit<Svg, 'id' | 'createdAt'>): SvgEntity {
    return new SvgEntity(
      crypto.randomUUID(),
      data.fileName,
      data.originalName,
      data.mimeType,
      data.size,
      data.url,
      data.bucket,
      data.path,
      data.entityType,
      data.entityId,
      new Date(),
      data.dimensions,
      data.viewBox,
      data.optimized
    );
  }

  isValidSvgType(): boolean {
    const validTypes = ['image/svg+xml', 'application/svg+xml'];
    return validTypes.includes(this.mimeType);
  }

  isWithinSizeLimit(maxSizeInMB: number = 2): boolean {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return this.size <= maxSizeInBytes;
  }

  getFileExtension(): string {
    return this.fileName.split('.').pop() || '';
  }

  hasValidDimensions(): boolean {
    if (!this.dimensions) return true;
    const { width, height } = this.dimensions;
    return !width || !height || (width > 0 && height > 0);
  }

  isOptimized(): boolean {
    return this.optimized;
  }

  getViewBox(): string | undefined {
    return this.viewBox;
  }

  static validateSvgContent(svgContent: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!svgContent.includes('<svg')) {
      errors.push('SVG content must contain <svg> tag');
    }

    if (svgContent.includes('<script')) {
      errors.push('SVG content cannot contain <script> tags for security reasons');
    }

    if (svgContent.includes('javascript:')) {
      errors.push('SVG content cannot contain javascript: URLs for security reasons');
    }

    if (svgContent.length > 1000000) {
      errors.push('SVG content is too large (max 1MB)');
    }

    return { isValid: errors.length === 0, errors };
  }

  static extractSvgMetadata(svgContent: string): {
    dimensions?: { width?: number; height?: number };
    viewBox?: string;
  } {
    const metadata: {
      dimensions?: { width?: number; height?: number };
      viewBox?: string;
    } = {};

    const widthMatch = svgContent.match(/width\s*=\s*["']?(\d+(?:\.\d+)?)["']?/i);
    const heightMatch = svgContent.match(/height\s*=\s*["']?(\d+(?:\.\d+)?)["']?/i);

    if (widthMatch && heightMatch) {
      metadata.dimensions = {
        width: parseFloat(widthMatch[1]),
        height: parseFloat(heightMatch[1])
      };
    }

    const viewBoxMatch = svgContent.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (viewBoxMatch) {
      metadata.viewBox = viewBoxMatch[1];
    }

    return metadata;
  }
}
