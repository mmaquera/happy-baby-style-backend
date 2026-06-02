import DOMPurify from 'isomorphic-dompurify';
import {
  RequiredFieldError,
  InvalidFormatError,
} from '../../domain/errors/DomainError';
import { SvgEntityType } from '../../domain/entities/Svg';
import { LoggerFactory, ILogger } from '@hbs/logging';

// ITEM A — isomorphic-dompurify is imported as a module-level singleton (not instantiated
// per request). Per-call sanitize() options are passed directly in sanitizeSvgContent and
// are the authoritative configuration. DOMPurify.setConfig() is intentionally NOT called
// here because per-call options passed to sanitize() REPLACE (not merge with) any setConfig,
// making a module-level setConfig redundant and potentially misleading to future maintainers.

// Post-sanitize canary patterns — checked ONLY on DOMPurify's output as defence-in-depth.
// If DOMPurify works correctly these should never match. Matching means DOMPurify failed
// to remove a known dangerous construct and the upload must be rejected (+ logger.error).
//
// Design constraints for each pattern:
//
// 1. Tag patterns use [\s\/>] after the tag name to avoid matching valid SVG elements
//    whose name merely STARTS WITH the dangerous name:
//      <scripted-path>, <object-group>, <embedded-icon>, <linked-icon>, <metadata>
//    would all false-fire if we used /<script/i, /<object/i, etc. (substring match).
//    Adding [\s\/>] requires the tag name to end (whitespace, self-close, or close).
//
// 2. The on* pattern is scoped to attribute syntax: \bon\w+\s*=\s*["']
//    This avoids false positives from text content or data attribute values
//    (e.g., data-section="online=true", <title>status: online=1</title>).
//    A real event-handler attribute always has the form: onXxx="..." or onXxx='...'
//    isomorphic-dompurify uses jsdom for DOM serialization, which ALWAYS quotes
//    attribute values, so a bypass in DOMPurify output would still use quoted syntax.
const POST_SANITIZE_CANARY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /<script[\s/>]/i,          label: '<script>' },
  { pattern: /javascript:/i,            label: 'javascript:' },
  { pattern: /\bon\w+\s*=\s*["']/i,    label: 'on* event handler' },
  { pattern: /<iframe[\s/>]/i,          label: '<iframe>' },
  { pattern: /<object[\s/>]/i,          label: '<object>' },
  { pattern: /<embed[\s/>]/i,           label: '<embed>' },
  { pattern: /<link[\s/>]/i,            label: '<link>' },
  { pattern: /<meta[\s/>]/i,            label: '<meta>' },
];

export interface SvgValidationRule {
  field: string;
  validator: (value: any, context?: any) => boolean;
  message: string;
}

export class SvgValidationService {
  // Lazy static logger — avoids circular-init issues when the module is loaded early.
  private static _logger: ILogger | undefined;
  private static get logger(): ILogger {
    if (!SvgValidationService._logger) {
      SvgValidationService._logger =
        LoggerFactory.getInstance().createServiceLogger('SvgValidationService');
    }
    return SvgValidationService._logger;
  }

  private static readonly SVG_MIME_TYPES = ['image/svg+xml', 'application/svg+xml'];

  private static readonly MAX_SVG_SIZE = 2 * 1024 * 1024; // 2MB
  private static readonly MIN_SVG_SIZE = 10; // 10 bytes
  private static readonly ALLOWED_EXTENSIONS = ['.svg'];

  static validateSvgUploadRequest(request: {
    file: any;
    entityType: SvgEntityType;
    entityId: string;
  }): void {
    if (!request.file) {
      throw new RequiredFieldError('File is required for SVG upload');
    }

    if (!request.entityType) {
      throw new RequiredFieldError('Entity type is required for SVG upload');
    }

    if (!request.entityId) {
      throw new RequiredFieldError('Entity ID is required for SVG upload');
    }

    if (!Object.values(SvgEntityType).includes(request.entityType)) {
      throw new InvalidFormatError(
        `Invalid entity type: ${request.entityType}. Must be one of: ${Object.values(SvgEntityType).join(', ')}`,
      );
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(request.entityId)) {
      throw new InvalidFormatError(
        'Entity ID must contain only alphanumeric characters, hyphens, and underscores',
      );
    }

    this.validateSvgFileBasic(request.file);
  }

  static validateSvgFileBasic(file: any): void {
    if (!file) {
      throw new RequiredFieldError('File is required');
    }

    const fileInfo = this.extractFileInfo(file);

    if (!this.SVG_MIME_TYPES.includes(fileInfo.mimetype)) {
      throw new InvalidFormatError(
        `Invalid MIME type: ${fileInfo.mimetype}. SVG files must be ${this.SVG_MIME_TYPES.join(' or ')}`,
      );
    }

    const extension = this.getFileExtension(fileInfo.filename);
    if (!this.ALLOWED_EXTENSIONS.includes(extension.toLowerCase())) {
      throw new InvalidFormatError(
        `Invalid file extension: ${extension}. SVG files must have .svg extension`,
      );
    }

    if (!fileInfo.filename || fileInfo.filename.trim().length === 0) {
      throw new InvalidFormatError('SVG filename cannot be empty');
    }

    if (fileInfo.filename.length > 255) {
      throw new InvalidFormatError('SVG filename is too long (maximum 255 characters)');
    }
  }

  static validateSvgFile(file: any, contentSize?: number): void {
    if (!file) {
      throw new RequiredFieldError('File is required');
    }

    const fileInfo = this.extractFileInfo(file);
    const actualSize = contentSize || fileInfo.size;

    if (actualSize < this.MIN_SVG_SIZE) {
      throw new InvalidFormatError('SVG file is too small (minimum 10 bytes)');
    }

    if (actualSize > this.MAX_SVG_SIZE) {
      throw new InvalidFormatError(
        `SVG file is too large (maximum ${this.MAX_SVG_SIZE / (1024 * 1024)}MB)`,
      );
    }

    if (!this.SVG_MIME_TYPES.includes(fileInfo.mimetype)) {
      throw new InvalidFormatError(
        `Invalid MIME type: ${fileInfo.mimetype}. SVG files must be ${this.SVG_MIME_TYPES.join(' or ')}`,
      );
    }

    const extension = this.getFileExtension(fileInfo.filename);
    if (!this.ALLOWED_EXTENSIONS.includes(extension.toLowerCase())) {
      throw new InvalidFormatError(
        `Invalid file extension: ${extension}. SVG files must have .svg extension`,
      );
    }

    if (!fileInfo.filename || fileInfo.filename.trim().length === 0) {
      throw new InvalidFormatError('SVG filename cannot be empty');
    }

    if (fileInfo.filename.length > 255) {
      throw new InvalidFormatError('SVG filename is too long (maximum 255 characters)');
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(fileInfo.filename)) {
      throw new InvalidFormatError(
        'SVG filename contains invalid characters. Only alphanumeric, dots, hyphens, and underscores are allowed',
      );
    }
  }

  static validateSvgContent(svgContent: string): void {
    if (!svgContent || typeof svgContent !== 'string') {
      throw new RequiredFieldError('SVG content is required');
    }

    if (svgContent.length === 0) {
      throw new InvalidFormatError('SVG content cannot be empty');
    }

    if (svgContent.length > 1000000) {
      throw new InvalidFormatError('SVG content is too large (maximum 1MB)');
    }

    if (!svgContent.includes('<svg')) {
      throw new InvalidFormatError('SVG content must contain <svg> tag');
    }

    if (!svgContent.includes('</svg>')) {
      throw new InvalidFormatError('SVG content must contain closing </svg> tag');
    }

    // Security checks are intentionally NOT run here on raw content to avoid false positives
    // on legitimate SVGs (e.g. attribute values that match /on\w+\s*=/i without being handlers).
    // DOMPurify is the primary sanitizer (called by sanitizeSvgContent after this method).
    // The post-sanitize canary in sanitizeSvgContent acts as defence-in-depth on the output.
    this.validateSvgStructure(svgContent);
  }

  /**
   * Post-sanitize canary — called on DOMPurify's OUTPUT only.
   * Should never throw in normal operation. If it does, DOMPurify failed to strip a known
   * dangerous construct, which is a library bug or bypass. We log at error level to alert
   * on-call before rejecting the upload.
   */
  private static runPostSanitizeCanary(sanitizedContent: string): void {
    for (const { pattern, label } of POST_SANITIZE_CANARY_PATTERNS) {
      if (pattern.test(sanitizedContent)) {
        SvgValidationService.logger.error(
          'Post-sanitize canary triggered — DOMPurify failed to remove dangerous construct',
          new Error(`Canary: ${label} still present after DOMPurify sanitization`),
          { label },
        );
        throw new InvalidFormatError(
          `SVG content was rejected: dangerous construct "${label}" survived sanitization`,
        );
      }
    }
  }

  private static validateSvgStructure(svgContent: string): void {
    if (!this.isValidXmlStructure(svgContent)) {
      throw new InvalidFormatError('SVG content must be valid XML');
    }

    const svgTagMatch = svgContent.match(/<svg[^>]*>/i);
    if (!svgTagMatch) {
      throw new InvalidFormatError('SVG content must contain a valid <svg> opening tag');
    }
  }

  private static isValidXmlStructure(content: string): boolean {
    try {
      const openTags = content.match(/<[^/][^>]*>/g) || [];
      const closeTags = content.match(/<\/[^>]*>/g) || [];
      const selfClosingTags = content.match(/<[^>]*\/>/g) || [];
      return openTags.length === closeTags.length + selfClosingTags.length;
    } catch {
      return false;
    }
  }

  static validateSvgDimensions(dimensions?: { width?: number; height?: number }): void {
    if (!dimensions) return;

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

  static validateViewBox(viewBox?: string): void {
    if (!viewBox) return;

    const viewBoxPattern = /^-?\d+(\.\d+)?\s+-?\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?$/;

    if (!viewBoxPattern.test(viewBox.trim())) {
      throw new InvalidFormatError(
        'SVG viewBox must be in format "x y width height" with numeric values',
      );
    }

    const values = viewBox.trim().split(/\s+/).map(Number);
    if (values.length !== 4) {
      throw new InvalidFormatError('SVG viewBox must contain exactly 4 numeric values');
    }

    const [, , width, height] = values;
    if (width <= 0 || height <= 0) {
      throw new InvalidFormatError('SVG viewBox width and height must be positive numbers');
    }
  }

  private static extractFileInfo(file: any): {
    filename: string;
    mimetype: string;
    size: number;
    encoding: string;
    buffer?: Buffer;
  } {
    const filename = file?.file?.filename || file?.filename || 'unknown';
    let mimetype = file?.file?.mimetype || file?.mimetype || 'unknown';

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

  private static getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return '';
    return filename.substring(lastDotIndex);
  }

  /**
   * ITEM C — SVG content-structure validation.
   *
   * SVG is a text format — there are no reliable binary magic bytes for detection.
   * By the time this method is called, the file content has already been decoded from
   * its raw bytes into a UTF-8 string (by UploadSvgUseCase.readSvgContent), so binary
   * magic-byte checks cannot be applied here (binary bytes are lossily destroyed by
   * the UTF-8 decode round-trip). Binary files uploaded as SVG are caught downstream
   * by validateSvgContent's requirement for a valid <svg> element.
   *
   * This method validates at the text level:
   *   1. Declared MIME type is an SVG MIME type.
   *   2. Buffer content has an <svg> root element (not an HTML page with scripts).
   *   3. Content is not an HTML document masquerading as SVG.
   *
   * This catches the common spoofing vector: uploading an HTML file with inline scripts
   * and mimetype "image/svg+xml" to bypass the MIME-type allowlist.
   */
  static validateSvgMagicBytes(buffer: Buffer, declaredMimeType: string): void {
    if (!this.SVG_MIME_TYPES.includes(declaredMimeType)) {
      throw new InvalidFormatError(
        `Declared MIME type "${declaredMimeType}" is not a valid SVG MIME type`,
      );
    }

    // Convert to string and verify it looks like XML/SVG, not HTML with scripts.
    // Note: binary inputs (JPEG/PNG uploaded as SVG) will appear as garbled text here;
    // they will fail the <svg> element check below since they contain no XML structure.
    const content = buffer.toString('utf8');

    // Must contain <svg (case-insensitive, possibly with namespace/whitespace)
    if (!/<svg[\s>]/i.test(content)) {
      throw new InvalidFormatError(
        'File content does not appear to be an SVG document — no <svg> element found.',
      );
    }

    // Reject if it looks like an HTML document (DOCTYPE html or <html> root)
    if (/<!DOCTYPE\s+html/i.test(content) || /^\s*<html[\s>]/i.test(content)) {
      throw new InvalidFormatError(
        'File content appears to be an HTML document, not an SVG. ' +
          'Declared MIME type does not match actual file content.',
      );
    }
  }

  /**
   * Composite method — enforces the mandatory security pipeline in one call.
   *
   * Sequence (non-negotiable):
   *   1. validateSvgContent  — structural checks on raw input (presence of <svg>,
   *      closing tag, XML structure, size bounds). Throws on malformed input.
   *   2. sanitizeSvgContent  — DOMPurify strip + post-sanitize canary.
   *      Throws if DOMPurify removes everything OR if the canary fires.
   *
   * Callers MUST use this method instead of orchestrating the two steps individually.
   * The separation of validateSvgContent and sanitizeSvgContent is intentional
   * (different concerns, independently testable), but calling them in isolation is
   * unsafe: a caller that validates without sanitizing would serve unstripped XSS.
   *
   * Returns the sanitized SVG string ready for storage.
   */
  static validateAndSanitize(svgContent: string): string {
    this.validateSvgContent(svgContent);
    return this.sanitizeSvgContent(svgContent);
  }

  /**
   * ITEM A — DOMPurify-based sanitizer (replaces bypasseable regex approach).
   * ITEM B — Sanitization is UNCONDITIONAL. There is no flag to disable it.
   *
   * Uses isomorphic-dompurify (bundles jsdom) which works in Node/CommonJS.
   * The shared DOMPurify instance is configured once at module load time
   * (USE_PROFILES: svg + svgFilters; FORBID_TAGS for script/foreignObject/etc.).
   *
   * DOMPurify removes:
   *   - <script>, <foreignObject>, <iframe>, <object>, <embed>, <link>, <meta>
   *   - All on* event-handler attributes (onclick, onload, onerror, …)
   *   - href="javascript:…" and similar protocol-handler URLs
   *   - CDATA sections that could carry script payloads
   *
   * Returns the sanitized SVG string. Never returns the original unsanitized content.
   */
  static sanitizeSvgContent(svgContent: string): string {
    const sanitized = DOMPurify.sanitize(svgContent, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORCE_BODY: false,
      ADD_TAGS: ['svg'],
      FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'link', 'meta', 'style'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'href'],
    });

    // DOMPurify returns a string; if the output is empty, the input was entirely
    // malicious (e.g. pure <script> without an <svg> wrapper). Reject it.
    if (!sanitized || sanitized.trim().length === 0) {
      throw new InvalidFormatError(
        'SVG content was rejected by the sanitizer — all content was stripped as unsafe',
      );
    }

    // Defence-in-depth: verify DOMPurify actually removed all dangerous constructs.
    // This is a canary — should never fire. If it does, it means DOMPurify has a bug
    // or bypass and we must not serve the output.
    this.runPostSanitizeCanary(sanitized);

    return sanitized;
  }
}
