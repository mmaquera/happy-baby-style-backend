export interface Image {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  bucket: string;
  path: string;
  entityType: ImageEntityType;
  entityId: string;
  createdAt: Date;
}

export enum ImageEntityType {
  PRODUCT = 'product',
  USER = 'user',
  CATEGORY = 'category'
}

export class ImageEntity implements Image {
  constructor(
    public readonly id: string,
    public readonly fileName: string,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly url: string,
    public readonly bucket: string,
    public readonly path: string,
    public readonly entityType: ImageEntityType,
    public readonly entityId: string,
    public readonly createdAt: Date
  ) {}

  static create(data: Omit<Image, 'id' | 'createdAt'>): ImageEntity {
    return new ImageEntity(
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
      new Date()
    );
  }

  isValidImageType(): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return validTypes.includes(this.mimeType);
  }

  isWithinSizeLimit(maxSizeInMB: number = 5): boolean {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return this.size <= maxSizeInBytes;
  }

  getFileExtension(): string {
    return this.fileName.split('.').pop() || '';
  }
}