import type { TokenPayload } from '@hbs/auth';
import { ImageEntity, ImageEntityType } from '../entities/Image';

export interface IImageRepository {
  create(image: ImageEntity, currentUser?: TokenPayload | null): Promise<ImageEntity>;
  findById(id: string): Promise<ImageEntity | null>;
  findAll(filters?: ImageFilters): Promise<ImageEntity[]>;
  findByEntityId(
    entityId: string,
    entityType: ImageEntityType,
    limit?: number,
    offset?: number,
  ): Promise<ImageEntity[]>;
  delete(id: string, currentUser?: TokenPayload | null): Promise<void>;
  deleteByEntityId(
    entityId: string,
    entityType: ImageEntityType,
    currentUser?: TokenPayload | null,
  ): Promise<void>;
}

export interface ImageFilters {
  entityType?: ImageEntityType;
  entityId?: string;
  mimeType?: string;
  limit?: number;
  offset?: number;
}
