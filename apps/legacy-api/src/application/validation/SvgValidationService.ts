import {
  ValidationError,
  RequiredFieldError,
  InvalidFormatError,
} from '@domain/errors/DomainError';
import { SvgEntityType } from '@domain/entities/Svg';

export interface SvgValidationRule {
  field: string;
  validator: (value: any, context?: any) => boolean;
  message: string;
}

export class SvgValidationService {
  private static readonly SVG_MIME_TYPES = ['image/svg+xml', 'application/svg+xml'];

  private static readonly MAX_SVG_SIZE = 2 * 1024 * 1024; // 2MB
  private static readonly MIN_SVG_SIZE = 10; // 10 bytes

  private static readonly ALLOWED_EXTENSIONS = ['.svg'];

  /**
   * Validates SVG file upload request
   */
  static validateSvgUploadRequest(request: {
    file: any;
    entityType: SvgEntityType;
    entityId: string;
  }): void {
    const errors: string[] = [];

    // Validate required fields
    if (!request.file) {
      throw new RequiredFieldError('File is required for SVG upload');
    }

    if (!request.entityType) {
      throw new RequiredFieldError('Entity type is required for SVG upload');
    }

    if (!request.entityId) {
      throw new RequiredFieldError('Entity ID is required for SVG upload');
    }

    // Validate entity type
    if (!Object.values(SvgEntityType).includes(request.entityType)) {
      throw new InvalidFormatError(
        `Invalid entity type: ${request.entityType}. Must be one of: ${Object.values(SvgEntityType).join(', ')}`,
      );
    }

    // Validate entity ID format (basic UUID or alphanumeric)
    if (!/^[a-zA-Z0-9-_]+$/.test(request.entityId)) {
      throw new InvalidFormatError(
        'Entity ID must contain only alphanumeric characters, hyphens, and underscores',
      );
    }

    // Validate file properties (basic validation without content size)
    this.validateSvgFileBasic(request.file);
  }

  /**
   * Validates SVG file properties (basic validation without content size)
   */
  static validateSvgFileBasic(file: any): void {
    if (!file) {
      throw new RequiredFieldError('File is required');
    }

    // Extract file information
    const fileInfo = this.extractFileInfo(file);

    // Validate MIME type
    if (!this.SVG_MIME_TYPES.includes(fileInfo.mimetype)) {
      throw new InvalidFormatError(
        `Invalid MIME type: ${fileInfo.mimetype}. SVG files must be ${this.SVG_MIME_TYPES.join(' or ')}`,
      );
    }

    // Validate file extension
    const extension = this.getFileExtension(fileInfo.filename);
    if (!this.ALLOWED_EXTENSIONS.includes(extension.toLowerCase())) {
      throw new InvalidFormatError(
        `Invalid file extension: ${extension}. SVG files must have .svg extension`,
      );
    }

    // Validate filename
    if (!fileInfo.filename || fileInfo.filename.trim().length === 0) {
      throw new InvalidFormatError('SVG filename cannot be empty');
    }

    // Validate filename length
    if (fileInfo.filename.length > 255) {
      throw new InvalidFormatError('SVG filename is too long (maximum 255 characters)');
    }
  }

  /**
   * Validates SVG file properties with content size
   */
  static validateSvgFile(file: any, contentSize?: number): void {
    if (!file) {
      throw new RequiredFieldError('File is required');
    }

    // Extract file information
    const fileInfo = this.extractFileInfo(file);

    // Use content size if provided, otherwise use file size
    const actualSize = contentSize || fileInfo.size;

    // Validate file size
    if (actualSize < this.MIN_SVG_SIZE) {
      throw new InvalidFormatError('SVG file is too small (minimum 10 bytes)');
    }

    if (actualSize > this.MAX_SVG_SIZE) {
      throw new InvalidFormatError(
        `SVG file is too large (maximum ${this.MAX_SVG_SIZE / (1024 * 1024)}MB)`,
      );
    }

    // Validate MIME type
    if (!this.SVG_MIME_TYPES.includes(fileInfo.mimetype)) {
      throw new InvalidFormatError(
        `Invalid MIME type: ${fileInfo.mimetype}. SVG files must be ${this.SVG_MIME_TYPES.join(' or ')}`,
      );
    }

    // Validate file extension
    const extension = this.getFileExtension(fileInfo.filename);
    if (!this.ALLOWED_EXTENSIONS.includes(extension.toLowerCase())) {
      throw new InvalidFormatError(
        `Invalid file extension: ${extension}. SVG files must have .svg extension`,
      );
    }

    // Validate filename
    if (!fileInfo.filename || fileInfo.filename.trim().length === 0) {
      throw new InvalidFormatError('SVG filename cannot be empty');
    }

    // Validate filename length
    if (fileInfo.filename.length > 255) {
      throw new InvalidFormatError('SVG filename is too long (maximum 255 characters)');
    }

    // Validate filename characters
    if (!/^[a-zA-Z0-9._-]+$/.test(fileInfo.filename)) {
      throw new InvalidFormatError(
        'SVG filename contains invalid characters. Only alphanumeric, dots, hyphens, and underscores are allowed',
      );
    }
  }

  /**
   * Validates SVG content for security and structure
   */
  static validateSvgContent(svgContent: string): void {
    if (!svgContent || typeof svgContent !== 'string') {
      throw new RequiredFieldError('SVG content is required');
    }

    // Check content length
    if (svgContent.length === 0) {
      throw new InvalidFormatError('SVG content cannot be empty');
    }

    if (svgContent.length > 1000000) {
      // 1MB
      throw new InvalidFormatError('SVG content is too large (maximum 1MB)');
    }

    // Check for basic SVG structure
    if (!svgContent.includes('<svg')) {
      throw new InvalidFormatError('SVG content must contain <svg> tag');
    }

    if (!svgContent.includes('</svg>')) {
      throw new InvalidFormatError('SVG content must contain closing </svg> tag');
    }

    // Security validations
    this.validateSvgSecurity(svgContent);

    // Structure validations
    this.validateSvgStructure(svgContent);
  }

  /**
   * Validates SVG content for security issues
   */
  private static validateSvgSecurity(svgContent: string): void {
    const securityChecks = [
      {
        pattern: /<script/i,
        message: 'SVG content cannot contain <script> tags for security reasons',
      },
      {
        pattern: /javascript:/i,
        message: 'SVG content cannot contain javascript: URLs for security reasons',
      },
      {
        pattern: /on\w+\s*=/i,
        message: 'SVG content cannot contain event handlers (on*) for security reasons',
      },
      {
        pattern: /<iframe/i,
        message: 'SVG content cannot contain <iframe> tags for security reasons',
      },
      {
        pattern: /<object/i,
        message: 'SVG content cannot contain <object> tags for security reasons',
      },
      {
        pattern: /<embed/i,
        message: 'SVG content cannot contain <embed> tags for security reasons',
      },
      {
        pattern: /<link/i,
        message: 'SVG content cannot contain <link> tags for security reasons',
      },
      {
        pattern: /<meta/i,
        message: 'SVG content cannot contain <meta> tags for security reasons',
      },
    ];

    for (const check of securityChecks) {
      if (check.pattern.test(svgContent)) {
        throw new InvalidFormatError(check.message);
      }
    }
  }

  /**
   * Validates SVG structure and format
   */
  private static validateSvgStructure(svgContent: string): void {
    // Check for proper XML structure
    if (!this.isValidXmlStructure(svgContent)) {
      throw new InvalidFormatError('SVG content must be valid XML');
    }

    // Check for reasonable SVG structure
    const svgTagMatch = svgContent.match(/<svg[^>]*>/i);
    if (!svgTagMatch) {
      throw new InvalidFormatError('SVG content must contain a valid <svg> opening tag');
    }

    // Check for xmlns attribute (recommended)
    if (!svgContent.includes('xmlns=') && !svgContent.includes('xmlns:')) {
      // This is a warning, not an error, but we'll log it
      console.warn('SVG content should include xmlns attribute for better compatibility');
    }
  }

  /**
   * Validates XML structure
   */
  private static isValidXmlStructure(content: string): boolean {
    try {
      // Basic XML structure validation
      const openTags = content.match(/<[^/][^>]*>/g) || [];
      const closeTags = content.match(/<\/[^>]*>/g) || [];
      const selfClosingTags = content.match(/<[^>]*\/>/g) || [];

      // Simple check: number of opening tags should equal closing tags
      // (excluding self-closing tags)
      const totalOpenTags = openTags.length;
      const totalCloseTags = closeTags.length;
      const totalSelfClosingTags = selfClosingTags.length;

      return totalOpenTags === totalCloseTags + totalSelfClosingTags;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates SVG dimensions
   */
  static validateSvgDimensions(dimensions?: { width?: number; height?: number }): void {
    if (!dimensions) {
      return; // Dimensions are optional
    }

    const { width, height } = dimensions;

    if (width !== undefined) {
      if (typeof width !== 'number' || width <= 0) {
        throw new InvalidFormatError('SVG width must be a positive number');
      }
      if (width > 10000) {
        throw new InvalidFormatError('SVG width is too large (maximum 10000px)');
      }
    }

    if (height !== undefined) {
      if (typeof height !== 'number' || height <= 0) {
        throw new InvalidFormatError('SVG height must be a positive number');
      }
      if (height > 10000) {
        throw new InvalidFormatError('SVG height is too large (maximum 10000px)');
      }
    }
  }

  /**
   * Validates viewBox attribute
   */
  static validateViewBox(viewBox?: string): void {
    if (!viewBox) {
      return; // ViewBox is optional
    }

    // ViewBox should be in format: "x y width height"
    const viewBoxPattern = /^-?\d+(\.\d+)?\s+-?\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?$/;

    if (!viewBoxPattern.test(viewBox.trim())) {
      throw new InvalidFormatError(
        'SVG viewBox must be in format "x y width height" with numeric values',
      );
    }

    // Parse and validate values
    const values = viewBox.trim().split(/\s+/).map(Number);
    if (values.length !== 4) {
      throw new InvalidFormatError('SVG viewBox must contain exactly 4 numeric values');
    }

    const [x, y, width, height] = values;

    if (width <= 0 || height <= 0) {
      throw new InvalidFormatError('SVG viewBox width and height must be positive numbers');
    }
  }

  /**
   * Extracts file information from upload object
   */
  private static extractFileInfo(file: any): {
    filename: string;
    mimetype: string;
    size: number;
    encoding: string;
    buffer?: Buffer;
  } {
    // Handle GraphQL Upload object structure
    const filename = file?.file?.filename || file?.filename || 'unknown';
    let mimetype = file?.file?.mimetype || file?.mimetype || 'unknown';

    // If MIME type is unknown but filename has .svg extension, assume SVG
    if (mimetype === 'unknown' && filename.toLowerCase().endsWith('.svg')) {
      mimetype = 'image/svg+xml';
    }

    return {
      filename,
      mimetype,
      size: file?.file?.size || file?.size || 0,
      encoding: file?.file?.encoding || file?.encoding || 'unknown',
      buffer: file?.file?.buffer || file?.buffer,
    };
  }

  /**
   * Gets file extension from filename
   */
  private static getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return '';
    }
    return filename.substring(lastDotIndex);
  }

  /**
   * Validates batch of SVG files
   */
  static validateSvgBatch(files: any[]): void {
    if (!Array.isArray(files)) {
      throw new InvalidFormatError('Files must be an array');
    }

    if (files.length === 0) {
      throw new RequiredFieldError('At least one SVG file is required');
    }

    if (files.length > 10) {
      throw new InvalidFormatError('Maximum 10 SVG files can be uploaded at once');
    }

    // Validate each file
    files.forEach((file, index) => {
      try {
        this.validateSvgFile(file);
      } catch (error) {
        throw new InvalidFormatError(
          `File ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    });
  }

  /**
   * Sanitizes SVG content by removing potentially dangerous elements
   */
  static sanitizeSvgContent(svgContent: string): string {
    let sanitized = svgContent;

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Remove event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:[^"'\s]*/gi, '');

    // Remove potentially dangerous tags
    const dangerousTags = ['iframe', 'object', 'embed', 'link', 'meta'];
    dangerousTags.forEach((tag) => {
      const regex = new RegExp(`<${tag}[^>]*>[\s\S]*?<\/${tag}>`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    return sanitized;
  }
}
