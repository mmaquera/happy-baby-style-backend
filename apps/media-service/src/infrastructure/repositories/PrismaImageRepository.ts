import { PrismaClient } from '@prisma/client';
import type { TokenPayload } from '@hbs/auth';
import type { RecordRuleResolver } from '@hbs/authz';
import { assertWriteAccess } from '@hbs/authz';
import { IImageRepository, ImageFilters } from '../../domain/repositories/IImageRepository';
import { ImageEntity, ImageEntityType } from '../../domain/entities/Image';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';

export class PrismaImageRepository implements IImageRepository {
  private readonly logger: ILogger;

  /**
   * @param prisma - Singleton PrismaClient from @hbs/prisma.
   * @param recordRuleResolver - Optional RecordRuleResolver for record-level write access.
   *   When absent, writes are unrestricted (compat during rollout).
   *
   * READ access decision: media assets (images/SVGs) are public-facing files whose
   * URLs are served statically. Reads are therefore not gated behind record rules —
   * the existing auth plugin already requires authentication for mutations, and
   * `requireRole(ADMIN)` guards deletes. If private-asset rules are required in a
   * future phase, add resolveWhere('Image', 'read', currentUser) to findById/findAll.
   */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly recordRuleResolver?: RecordRuleResolver,
  ) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaImageRepository');
  }

  async create(image: ImageEntity, currentUser: TokenPayload | null = null): Promise<ImageEntity> {
    // CREATE is not gated by record rules in Fase 2.
    // Authorization is handled by the requireRole(ADMIN) guard in the resolver layer.
    // Record-rule enforcement for creates (if ever needed) is deferred to Fase 3.
    // The currentUser parameter is retained for interface compatibility and audit logging.
    void currentUser;

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

  async delete(id: string, currentUser: TokenPayload | null = null): Promise<void> {
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

  async deleteByEntityId(
    entityId: string,
    entityType: ImageEntityType,
    currentUser: TokenPayload | null = null,
  ): Promise<void> {
    // Bulk delete: resolve the rule where-clause.
    // If ruleWhere is non-empty (any restriction including DENY_WHERE), throw — we cannot
    // safely apply per-row semantics across a bulk operation and the caller should use
    // single-record delete paths instead. This preserves consistent error semantics with
    // the single-record delete which probes and throws NotFoundError on denial.
    const ruleWhere = this.recordRuleResolver
      ? await this.recordRuleResolver.resolveWhere('Image', 'unlink', currentUser)
      : {};

    if (Object.keys(ruleWhere).length > 0) {
      this.logger.warn('deleteByEntityId denied by record rule', { entityId, entityType });
      throw new NotFoundError('Image', `entity:${entityType}:${entityId}`);
    }

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
