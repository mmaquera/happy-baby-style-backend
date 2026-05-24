import { storageConfig } from '@config/storage';

/**
 * Utility class for building URLs from relative paths stored in the database
 * This provides flexibility for different environments and CDNs
 */
export class UrlBuilder {
  /**
   * Constructs a full public URL from a relative path stored in the database
   * @param relativePath - The relative path stored in the database (e.g., "uploads/categories/123/file.svg")
   * @returns Full public URL (e.g., "http://localhost:3000/uploads/categories/123/file.svg")
   */
  static buildPublicUrl(relativePath: string): string {
    if (!relativePath) {
      return '';
    }

    // Remove leading slash if present to avoid double slashes
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    
    // Ensure baseUrl doesn't end with slash to avoid double slashes
    const cleanBaseUrl = storageConfig.baseUrl.endsWith('/') 
      ? storageConfig.baseUrl.slice(0, -1) 
      : storageConfig.baseUrl;
    
    return `${cleanBaseUrl}/${cleanPath}`;
  }

  /**
   * Constructs a full public URL for SVG files
   * @param svgPath - The SVG path stored in the database
   * @returns Full public URL for the SVG
   */
  static buildSvgUrl(svgPath: string): string {
    return this.buildPublicUrl(svgPath);
  }

  /**
   * Constructs a full public URL for image files
   * @param imagePath - The image path stored in the database
   * @returns Full public URL for the image
   */
  static buildImageUrl(imagePath: string): string {
    return this.buildPublicUrl(imagePath);
  }

  /**
   * Validates if a URL is a full URL (contains protocol)
   * @param url - The URL to validate
   * @returns true if it's a full URL, false if it's a relative path
   */
  static isFullUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Ensures a URL is a full URL, converting relative paths if necessary
   * @param url - The URL (could be relative or full)
   * @returns Full URL
   */
  static ensureFullUrl(url: string): string {
    if (this.isFullUrl(url)) {
      return url;
    }
    return this.buildPublicUrl(url);
  }
}








