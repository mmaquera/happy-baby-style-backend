import { PrismaClient } from '@prisma/client';
import { IImageRepository, ImageFilters } from '@domain/repositories/IImageRepository';
import { ImageEntity, ImageEntityType } from '@domain/entities/Image';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';

export class PrismaImageRepository implements IImageRepository {
  private readonly logger: ILogger;

  constructor(private prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaImageRepository');
  }

  async create(image: ImageEntity): Promise<ImageEntity> {
    try {
      const createdImage = await this.prisma.image.create({
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

      this.logger.info('Image created successfully', { imageId: createdImage.id });
      return this.mapToImageEntity(createdImage);
    } catch (error) {
      this.logger.error('Error creating image', { error: error.message, image });
      throw error;
    }
  }

  async findById(id: string): Promise<ImageEntity | null> {
    try {
      const image = await this.prisma.image.findUnique({
        where: { id },
      });

      if (!image) {
        this.logger.debug('Image not found', { imageId: id });
        return null;
      }

      return this.mapToImageEntity(image);
    } catch (error) {
      this.logger.error('Error finding image by id', { error: error.message, imageId: id });
      throw error;
    }
  }

  async findAll(filters?: ImageFilters): Promise<ImageEntity[]> {
    try {
      const where: any = {};

      if (filters?.entityType) {
        where.entityType = filters.entityType;
      }

      if (filters?.entityId) {
        where.entityId = filters.entityId;
      }

      if (filters?.mimeType) {
        where.mimeType = filters.mimeType;
      }

      const images = await this.prisma.image.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit,
        skip: filters?.offset,
      });

      this.logger.debug('Images found', { count: images.length, filters });
      return images.map(image => this.mapToImageEntity(image));
    } catch (error) {
      this.logger.error('Error finding images', { error, filters });
      throw error;
    }
  }

  async findByEntityId(entityId: string, entityType: ImageEntityType): Promise<ImageEntity[]> {
    try {
      const images = await this.prisma.image.findMany({
        where: {
          entityId,
          entityType,
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug('Images found by entity', { entityId, entityType, count: images.length });
      return images.map(image => this.mapToImageEntity(image));
    } catch (error) {
      this.logger.error('Error finding images by entity', { error, entityId, entityType });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.image.delete({
        where: { id },
      });

      this.logger.info('Image deleted successfully', { imageId: id });
    } catch (error) {
      this.logger.error('Error deleting image', { error, imageId: id });
      throw error;
    }
  }

  async deleteByEntityId(entityId: string, entityType: ImageEntityType): Promise<void> {
    try {
      await this.prisma.image.deleteMany({
        where: {
          entityId,
          entityType,
        },
      });

      this.logger.info('Images deleted by entity successfully', { entityId, entityType });
    } catch (error) {
      this.logger.error('Error deleting images by entity', { error, entityId, entityType });
      throw error;
    }
  }

  private mapToImageEntity(prismaImage: any): ImageEntity {
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
      prismaImage.createdAt
    );
  }
}
