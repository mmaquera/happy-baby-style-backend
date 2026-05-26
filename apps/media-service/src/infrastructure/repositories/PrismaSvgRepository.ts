import { PrismaClient } from '@prisma/client';
import { SvgEntity, SvgEntityType } from '../../domain/entities/Svg';
import { ISvgRepository } from '../../domain/repositories/ISvgRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class PrismaSvgRepository implements ISvgRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('SvgRepository');
  }

  async create(svg: SvgEntity): Promise<SvgEntity> {
    try {
      const created = await this.prisma.image.create({
        data: {
          id: svg.id,
          fileName: svg.fileName,
          originalName: svg.originalName,
          mimeType: svg.mimeType,
          size: svg.size,
          url: svg.url,
          bucket: svg.bucket,
          path: svg.path,
          entityType: svg.entityType,
          entityId: svg.entityId,
          createdAt: svg.createdAt,
          dimensions: svg.dimensions ? JSON.stringify(svg.dimensions) : null,
          viewBox: svg.viewBox,
          optimized: svg.optimized
        }
      });

      this.logger.info('SVG created', { svgId: created.id });
      return this.mapToEntity(created);
    } catch (error) {
      this.logger.error('Error creating SVG', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findById(id: string): Promise<SvgEntity | null> {
    try {
      const image = await this.prisma.image.findUnique({ where: { id } });
      if (!image) return null;
      return this.mapToEntity(image);
    } catch (error) {
      this.logger.error('Error finding SVG by id', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findByEntity(entityType: SvgEntityType, entityId: string): Promise<SvgEntity[]> {
    try {
      const images = await this.prisma.image.findMany({
        where: {
          entityType,
          entityId,
          mimeType: { in: ['image/svg+xml', 'application/svg+xml'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      return images.map(img => this.mapToEntity(img));
    } catch (error) {
      this.logger.error('Error finding SVGs by entity', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findByFileName(fileName: string): Promise<SvgEntity | null> {
    try {
      const image = await this.prisma.image.findFirst({
        where: {
          fileName,
          mimeType: { in: ['image/svg+xml', 'application/svg+xml'] }
        }
      });

      if (!image) return null;
      return this.mapToEntity(image);
    } catch (error) {
      this.logger.error('Error finding SVG by filename', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async update(id: string, updates: Partial<SvgEntity>): Promise<SvgEntity | null> {
    try {
      const updateData: any = {};
      if (updates.fileName) updateData.fileName = updates.fileName;
      if (updates.originalName) updateData.originalName = updates.originalName;
      if (updates.mimeType) updateData.mimeType = updates.mimeType;
      if (updates.size !== undefined) updateData.size = updates.size;
      if (updates.url) updateData.url = updates.url;
      if (updates.bucket) updateData.bucket = updates.bucket;
      if (updates.path) updateData.path = updates.path;
      if (updates.entityType) updateData.entityType = updates.entityType;
      if (updates.entityId) updateData.entityId = updates.entityId;
      if (updates.dimensions) updateData.dimensions = JSON.stringify(updates.dimensions);
      if (updates.viewBox) updateData.viewBox = updates.viewBox;
      if (updates.optimized !== undefined) updateData.optimized = updates.optimized;

      const updated = await this.prisma.image.update({ where: { id }, data: updateData });
      return this.mapToEntity(updated);
    } catch (error) {
      this.logger.error('Error updating SVG', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.image.delete({ where: { id } });
      this.logger.info('SVG deleted', { svgId: id });
      return true;
    } catch (error) {
      this.logger.error('Error deleting SVG', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findAll(limit?: number, offset?: number): Promise<SvgEntity[]> {
    try {
      const images = await this.prisma.image.findMany({
        where: { mimeType: { in: ['image/svg+xml', 'application/svg+xml'] } },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
      });

      return images.map(img => this.mapToEntity(img));
    } catch (error) {
      this.logger.error('Error finding SVGs', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async count(): Promise<number> {
    try {
      return await this.prisma.image.count({
        where: { mimeType: { in: ['image/svg+xml', 'application/svg+xml'] } }
      });
    } catch (error) {
      this.logger.error('Error counting SVGs', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findByEntityType(entityType: SvgEntityType, limit?: number, offset?: number): Promise<SvgEntity[]> {
    try {
      const images = await this.prisma.image.findMany({
        where: {
          entityType,
          mimeType: { in: ['image/svg+xml', 'application/svg+xml'] }
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
      });

      return images.map(img => this.mapToEntity(img));
    } catch (error) {
      this.logger.error('Error finding SVGs by entity type', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private mapToEntity(image: any): SvgEntity {
    return new SvgEntity(
      image.id,
      image.fileName,
      image.originalName,
      image.mimeType,
      image.size,
      image.url,
      image.bucket || 'local',
      image.path || '',
      image.entityType,
      image.entityId,
      image.createdAt,
      image.dimensions ? JSON.parse(image.dimensions) : undefined,
      image.viewBox,
      image.optimized || false
    );
  }
}
