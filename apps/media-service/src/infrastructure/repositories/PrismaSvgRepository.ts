import { PrismaClient } from '../../prisma';
import type { TokenPayload } from '@hbs/auth';
import type { RecordRuleResolver } from '@hbs/authz';
import { assertWriteAccess } from '@hbs/authz';
import { SvgEntity, SvgEntityType } from '../../domain/entities/Svg';
import { ISvgRepository } from '../../domain/repositories/ISvgRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class PrismaSvgRepository implements ISvgRepository {
  private readonly logger: ILogger;

  /**
   * @param prisma - Singleton PrismaClient from @hbs/prisma.
   * @param recordRuleResolver - Optional RecordRuleResolver for record-level write access.
   *   When absent, writes are unrestricted (compat during rollout).
   *
   * READ access decision: SVG assets are public-facing files served statically.
   * Reads are not gated behind record rules (same rationale as PrismaImageRepository).
   */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly recordRuleResolver?: RecordRuleResolver,
  ) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('SvgRepository');
  }

  async create(svg: SvgEntity, currentUser: TokenPayload | null = null): Promise<SvgEntity> {
    // CREATE is not gated by record rules in Fase 2.
    // Authorization is handled by the requireRole(ADMIN) guard in the resolver layer.
    // Record-rule enforcement for creates (if ever needed) is deferred to Fase 3.
    // The currentUser parameter is retained for interface compatibility and audit logging.
    void currentUser;

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
          optimized: svg.optimized,
        },
      });

      this.logger.info('SVG created', { svgId: created.id });
      return this.mapToEntity(created);
    } catch (error) {
      this.logger.error(
        'Error creating SVG',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findById(id: string): Promise<SvgEntity | null> {
    try {
      const image = await this.prisma.image.findUnique({ where: { id } });
      if (!image) return null;
      return this.mapToEntity(image);
    } catch (error) {
      this.logger.error(
        'Error finding SVG by id',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findByEntity(
    entityType: SvgEntityType,
    entityId: string,
    limit = 50,
    offset = 0,
  ): Promise<SvgEntity[]> {
    const cappedLimit = Math.min(limit, 100);
    try {
      const images = await this.prisma.image.findMany({
        where: {
          entityType,
          entityId,
          mimeType: { in: ['image/svg+xml', 'application/svg+xml'] },
        },
        orderBy: { createdAt: 'desc' },
        take: cappedLimit,
        skip: offset,
      });

      return images.map((img) => this.mapToEntity(img));
    } catch (error) {
      this.logger.error(
        'Error finding SVGs by entity',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findByFileName(fileName: string): Promise<SvgEntity | null> {
    try {
      const image = await this.prisma.image.findFirst({
        where: {
          fileName,
          mimeType: { in: ['image/svg+xml', 'application/svg+xml'] },
        },
      });

      if (!image) return null;
      return this.mapToEntity(image);
    } catch (error) {
      this.logger.error(
        'Error finding SVG by filename',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async update(
    id: string,
    updates: Partial<SvgEntity>,
    currentUser: TokenPayload | null = null,
  ): Promise<SvgEntity | null> {
    // Write guard: probes for the row under the record-rule filter before updating.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Image',
      mode: 'write',
      id,
      currentUser,
      exists: (where) =>
        this.prisma.image.findFirst({ where, select: { id: true } }).then(Boolean),
    });

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
      this.logger.error(
        'Error updating SVG',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async delete(id: string, currentUser: TokenPayload | null = null): Promise<boolean> {
    // Unlink guard: probes for the row under the record-rule filter before deleting.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Image',
      mode: 'unlink',
      id,
      currentUser,
      exists: (where) =>
        this.prisma.image.findFirst({ where, select: { id: true } }).then(Boolean),
    });

    try {
      await this.prisma.image.delete({ where: { id } });
      this.logger.info('SVG deleted', { svgId: id });
      return true;
    } catch (error) {
      this.logger.error(
        'Error deleting SVG',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findAll(limit?: number, offset?: number): Promise<SvgEntity[]> {
    // Cap at 100 to prevent unbounded queries regardless of the caller.
    // Passing take: undefined to Prisma omits the LIMIT clause entirely.
    const cappedLimit = Math.min(limit ?? 50, 100);
    try {
      const images = await this.prisma.image.findMany({
        where: { mimeType: { in: ['image/svg+xml', 'application/svg+xml'] } },
        take: cappedLimit,
        skip: offset ?? 0,
        orderBy: { createdAt: 'desc' },
      });

      return images.map((img) => this.mapToEntity(img));
    } catch (error) {
      this.logger.error(
        'Error finding SVGs',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async count(): Promise<number> {
    try {
      return await this.prisma.image.count({
        where: { mimeType: { in: ['image/svg+xml', 'application/svg+xml'] } },
      });
    } catch (error) {
      this.logger.error(
        'Error counting SVGs',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findByEntityType(
    entityType: SvgEntityType,
    limit?: number,
    offset?: number,
  ): Promise<SvgEntity[]> {
    try {
      const images = await this.prisma.image.findMany({
        where: {
          entityType,
          mimeType: { in: ['image/svg+xml', 'application/svg+xml'] },
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });

      return images.map((img) => this.mapToEntity(img));
    } catch (error) {
      this.logger.error(
        'Error finding SVGs by entity type',
        error instanceof Error ? error : new Error(String(error)),
      );
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
      image.optimized || false,
    );
  }
}
