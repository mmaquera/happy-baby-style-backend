import { ImageEntity, ImageEntityType } from '../entities/Image';

export interface IImageRepository {
  create(image: ImageEntity): Promise<ImageEntity>;
  findById(id: string): Promise<ImageEntity | null>;
  findAll(filters?: ImageFilters): Promise<ImageEntity[]>;
  findByEntityId(entityId: string, entityType: ImageEntityType): Promise<ImageEntity[]>;
  delete(id: string): Promise<void>;
  deleteByEntityId(entityId: string, entityType: ImageEntityType): Promise<void>;
}

export interface ImageFilters {
  entityType?: ImageEntityType;
  entityId?: string;
  mimeType?: string;
  limit?: number;
  offset?: number;
}
