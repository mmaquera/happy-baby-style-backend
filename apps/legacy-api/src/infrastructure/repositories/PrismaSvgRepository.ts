import { PrismaClient } from '@prisma/client';
import { SvgEntity, SvgEntityType } from '@domain/entities/Svg';
import { ISvgRepository } from '@domain/repositories/ISvgRepository';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { PerformanceLogger } from '@infrastructure/logging/PerformanceLogger';

export class PrismaSvgRepository implements ISvgRepository {
  private readonly logger: ILogger;
  private readonly performanceLogger: PerformanceLogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('SvgRepository');
    this.performanceLogger = new PerformanceLogger();
  }

  async create(svg: SvgEntity): Promise<SvgEntity> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('svgCreate', {
      entityType: svg.entityType,
      entityId: svg.entityId,
      fileName: svg.fileName
    });

    try {
      this.logger.info('Creating SVG entity', {
        svgId: svg.id,
        fileName: svg.fileName,
        entityType: svg.entityType,
        entityId: svg.entityId,
        context: 'PrismaSvgRepository.create'
      });

      const createdImage = await this.prisma.image.create({
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

      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { success: true });

      this.logger.info('SVG entity created successfully', {
        svgId: createdImage.id,
        fileName: createdImage.fileName,
        duration,
        context: 'PrismaSvgRepository.create'
      });

      return this.mapToEntity(createdImage);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Failed to create SVG entity', error instanceof Error ? error : new Error(String(error)), {
        svgId: svg.id,
        fileName: svg.fileName,
        duration,
        context: 'PrismaSvgRepository.create'
      });

      throw error;
    }
  }

  async findById(id: string): Promise<SvgEntity | null> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('svgFindById', { svgId: id });

    try {
      this.logger.debug('Finding SVG by ID', {
        svgId: id,
        context: 'PrismaSvgRepository.findById'
      });

      const image = await this.prisma.image.findUnique({
        where: { id }
      });

      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { success: true, found: !!image });

      if (image) {
        this.logger.debug('SVG found by ID', {
          svgId: id,
          fileName: image.fileName,
          duration,
          context: 'PrismaSvgRepository.findById'
        });
        return this.mapToEntity(image);
      }

      this.logger.debug('SVG not found by ID', {
        svgId: id,
        duration,
        context: 'PrismaSvgRepository.findById'
      });

      return null;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Failed to find SVG by ID', error instanceof Error ? error : new Error(String(error)), {
        svgId: id,
        duration,
        context: 'PrismaSvgRepository.findById'
      });

      throw error;
    }
  }

  async findByEntity(entityType: SvgEntityType, entityId: string): Promise<SvgEntity[]> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('svgFindByEntity', {
      entityType,
      entityId
    });

    try {
      this.logger.debug('Finding SVGs by entity', {
        entityType,
        entityId,
        context: 'PrismaSvgRepository.findByEntity'
      });

      const images = await this.prisma.image.findMany({
        where: {
          entityType,
          entityId,
          mimeType: {
            in: ['image/svg+xml', 'application/svg+xml']
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { success: true, count: images.length });

      this.logger.debug('SVGs found by entity', {
        entityType,
        entityId,
        count: images.length,
        duration,
        context: 'PrismaSvgRepository.findByEntity'
      });

      return images.map(image => this.mapToEntity(image));
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Failed to find SVGs by entity', error instanceof Error ? error : new Error(String(error)), {
        entityType,
        entityId,
        duration,
        context: 'PrismaSvgRepository.findByEntity'
      });

      throw error;
    }
  }

  async findByFileName(fileName: string): Promise<SvgEntity | null> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('svgFindByFileName', { fileName });

    try {
      this.logger.debug('Finding SVG by filename', {
        fileName,
        context: 'PrismaSvgRepository.findByFileName'
      });

      const image = await this.prisma.image.findFirst({
        where: { 
          fileName,
          mimeType: {
            in: ['image/svg+xml', 'application/svg+xml']
          }
        }
      });

      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { success: true, found: !!image });

      if (image) {
        this.logger.debug('SVG found by filename', {
          fileName,
          svgId: image.id,
          duration,
          context: 'PrismaSvgRepository.findByFileName'
        });
        return this.mapToEntity(image);
      }

      this.logger.debug('SVG not found by filename', {
        fileName,
        duration,
        context: 'PrismaSvgRepository.findByFileName'
      });

      return null;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Failed to find SVG by filename', error instanceof Error ? error : new Error(String(error)), {
        fileName,
        duration,
        context: 'PrismaSvgRepository.findByFileName'
      });

      throw error;
    }
  }

  async update(id: string, updates: Partial<SvgEntity>): Promise<SvgEntity | null> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('svgUpdate', { svgId: id });

    try {
      this.logger.info('Updating SVG entity', {
        svgId: id,
        updates: Object.keys(updates),
        context: 'PrismaSvgRepository.update'
      });

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

      const updatedImage = await this.prisma.image.update({
        where: { id },
        data: updateData
      });

      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { success: true });

      this.logger.info('SVG entity updated successfully', {
        svgId: id,
        fileName: updatedImage.fileName,
        duration,
        context: 'PrismaSvgRepository.update'
      });

      return this.mapToEntity(updatedImage);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Failed to update SVG entity', error instanceof Error ? error : new Error(String(error)), {
        svgId: id,
        duration,
        context: 'PrismaSvgRepository.update'
      });

      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('svgDelete', { svgId: id });

    try {
      this.logger.info('Deleting SVG entity', {
        svgId: id,
        context: 'PrismaSvgRepository.delete'
      });

      await this.prisma.image.delete({
        where: { id }
      });

      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { success: true });

      this.logger.info('SVG entity deleted successfully', {
        svgId: id,
        duration,
        context: 'PrismaSvgRepository.delete'
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Failed to delete SVG entity', error instanceof Error ? error : new Error(String(error)), {
        svgId: id,
        duration,
        context: 'PrismaSvgRepository.delete'
      });

      throw error;
    }
  }

  async findAll(limit?: number, offset?: number): Promise<SvgEntity[]> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('svgFindAll', { limit, offset });

    try {
      this.logger.debug('Finding all SVGs', {
        limit,
        offset,
        context: 'PrismaSvgRepository.findAll'
      });

      const images = await this.prisma.image.findMany({
        where: {
          mimeType: {
            in: ['image/svg+xml', 'application/svg+xml']
          }
        },
        take: limit,
        skip: offset,
        orderBy: {
          createdAt: 'desc'
        }
      });

      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { success: true, count: images.length });

      this.logger.debug('SVGs found', {
        count: images.length,
        limit,
        offset,
        duration,
        context: 'PrismaSvgRepository.findAll'
      });

      return images.map(image => this.mapToEntity(image));
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Failed to find all SVGs', error instanceof Error ? error : new Error(String(error)), {
        limit,
        offset,
        duration,
        context: 'PrismaSvgRepository.findAll'
      });

      throw error;
    }
  }

  async count(): Promise<number> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('svgCount');

    try {
      this.logger.debug('Counting SVGs', {
        context: 'PrismaSvgRepository.count'
      });

      const count = await this.prisma.image.count({
        where: {
          mimeType: {
            in: ['image/svg+xml', 'application/svg+xml']
          }
        }
      });

      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { success: true, count });

      this.logger.debug('SVG count retrieved', {
        count,
        duration,
        context: 'PrismaSvgRepository.count'
      });

      return count;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Failed to count SVGs', error instanceof Error ? error : new Error(String(error)), {
        duration,
        context: 'PrismaSvgRepository.count'
      });

      throw error;
    }
  }

  async findByEntityType(entityType: SvgEntityType, limit?: number, offset?: number): Promise<SvgEntity[]> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('svgFindByEntityType', {
      entityType,
      limit,
      offset
    });

    try {
      this.logger.debug('Finding SVGs by entity type', {
        entityType,
        limit,
        offset,
        context: 'PrismaSvgRepository.findByEntityType'
      });

      const images = await this.prisma.image.findMany({
        where: { 
          entityType,
          mimeType: {
            in: ['image/svg+xml', 'application/svg+xml']
          }
        },
        take: limit,
        skip: offset,
        orderBy: {
          createdAt: 'desc'
        }
      });

      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { success: true, count: images.length });

      this.logger.debug('SVGs found by entity type', {
        entityType,
        count: images.length,
        limit,
        offset,
        duration,
        context: 'PrismaSvgRepository.findByEntityType'
      });

      return images.map(image => this.mapToEntity(image));
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Failed to find SVGs by entity type', error instanceof Error ? error : new Error(String(error)), {
        entityType,
        limit,
        offset,
        duration,
        context: 'PrismaSvgRepository.findByEntityType'
      });

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
