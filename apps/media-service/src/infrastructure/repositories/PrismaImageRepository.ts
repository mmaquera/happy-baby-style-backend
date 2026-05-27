import { PrismaClient } from '@prisma/client';
import { IImageRepository, ImageFilters } from '../../domain/repositories/IImageRepository';
import { ImageEntity, ImageEntityType } from '../../domain/entities/Image';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class PrismaImageRepository implements IImageRepository {
  private readonly logger: ILogger;

  constructor(private prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaImageRepository');
  }

  async create(image: ImageEntity): Promise<ImageEntity> {
    try {
      const created = await this.prisma.image.create({
        data: {
          id: image.id,
          fileName: image.fileName,
          originalName: image.originalName,
          mimeType: image.mimeType,
          size: image.size,
          path: image.path,
          url: image.url,
          bucket: image.bucket,
          entityId: image.entityId,
          entityType: image.entityType,
        },
      });

      this.logger.info('Image created', { imageId: created.id });
      return this.mapToEntity(created);
    } catch (error) {
      this.logger.error(
        'Error creating image',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findById(id: string): Promise<ImageEntity | null> {
    try {
      const image = await this.prisma.image.findUnique({ where: { id } });
      if (!image) return null;
      return this.mapToEntity(image);
    } catch (error) {
      this.logger.error(
        'Error finding image by id',
        error instanceof Error ? error : new Error(String(error)),
        { imageId: id },
      );
      throw error;
    }
  }

  async findAll(filters?: ImageFilters): Promise<ImageEntity[]> {
    try {
      const where: any = {};
      if (filters?.entityType) where.entityType = filters.entityType;
      if (filters?.entityId) where.entityId = filters.entityId;
      if (filters?.mimeType) where.mimeType = filters.mimeType;

      const images = await this.prisma.image.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit,
        skip: filters?.offset,
      });

      return images.map((img) => this.mapToEntity(img));
    } catch (error) {
      this.logger.error(
        'Error finding images',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findByEntityId(entityId: string, entityType: ImageEntityType): Promise<ImageEntity[]> {
    try {
      const images = await this.prisma.image.findMany({
        where: { entityId, entityType },
        orderBy: { createdAt: 'desc' },
      });

      return images.map((img) => this.mapToEntity(img));
    } catch (error) {
      this.logger.error(
        'Error finding images by entity',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.image.delete({ where: { id } });
      this.logger.info('Image deleted', { imageId: id });
    } catch (error) {
      this.logger.error(
        'Error deleting image',
        error instanceof Error ? error : new Error(String(error)),
        { imageId: id },
      );
      throw error;
    }
  }

  async deleteByEntityId(entityId: string, entityType: ImageEntityType): Promise<void> {
    try {
      await this.prisma.image.deleteMany({ where: { entityId, entityType } });
      this.logger.info('Images deleted by entity', { entityId, entityType });
    } catch (error) {
      this.logger.error(
        'Error deleting images by entity',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private mapToEntity(prismaImage: any): ImageEntity {
    return new ImageEntity(
      prismaImage.id,
      prismaImage.fileName,
      prismaImage.originalName,
      prismaImage.mimeType,
      prismaImage.size,
      prismaImage.url,
      prismaImage.bucket,
      prismaImage.path,
      prismaImage.entityType as ImageEntityType,
      prismaImage.entityId,
      prismaImage.createdAt,
    );
  }
}
