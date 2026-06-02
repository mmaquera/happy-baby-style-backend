import { PrismaClient } from '../../prisma';
import { IAuditRepository } from '@domain/repositories/IAuditRepository';
import { AuditLog, CreateAuditLogRequest } from '@domain/entities/Audit';
import { ILogger } from '@hbs/logging';
import { LoggerFactory } from '@hbs/logging';

/**
 * Repositorio de infraestructura para logs de auditoría usando Prisma
 *
 * Principios aplicados:
 * - Clean Architecture: Implementación en la capa de infraestructura
 * - Dependency Inversion: Implementa IAuditRepository del dominio
 * - Single Responsibility: Solo maneja operaciones de auditoría
 */
export class PrismaAuditRepository implements IAuditRepository {
  private readonly logger: ILogger;

  constructor(private prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaAuditRepository');
  }

  async create(data: CreateAuditLogRequest): Promise<AuditLog> {
    const startTime = Date.now();

    try {
      this.logger.debug('Creating audit log', {
        action: data.action,
        userId: data.userId,
        tableName: data.tableName,
        context: 'PrismaAuditRepository.create',
      });

      const created = await this.prisma.auditLog.create({
        data: {
          userId: data.userId || null,
          action: data.action,
          tableName: data.tableName || null,
          recordId: data.recordId || null,
          oldValues: data.oldValues ? JSON.parse(JSON.stringify(data.oldValues)) : null,
          newValues: data.newValues ? JSON.parse(JSON.stringify(data.newValues)) : null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
        },
      });

      const duration = Date.now() - startTime;

      this.logger.info('Audit log created successfully', {
        auditLogId: created.id,
        action: created.action,
        duration,
        context: 'PrismaAuditRepository.create',
      });

      return this.mapToAuditLog(created);
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(
        'Failed to create audit log',
        error instanceof Error ? error : new Error(String(error)),
        {
          action: data.action,
          userId: data.userId,
          duration,
          context: 'PrismaAuditRepository.create',
        },
      );

      throw error;
    }
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    try {
      const logs = await this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return logs.map((log) => this.mapToAuditLog(log));
    } catch (error) {
      this.logger.error(
        'Failed to find audit logs by user id',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId,
          context: 'PrismaAuditRepository.findByUserId',
        },
      );
      throw error;
    }
  }

  async findByAction(action: string, limit: number = 100): Promise<AuditLog[]> {
    try {
      const logs = await this.prisma.auditLog.findMany({
        where: { action },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return logs.map((log) => this.mapToAuditLog(log));
    } catch (error) {
      this.logger.error(
        'Failed to find audit logs by action',
        error instanceof Error ? error : new Error(String(error)),
        {
          action,
          limit,
          context: 'PrismaAuditRepository.findByAction',
        },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<AuditLog | null> {
    try {
      const log = await this.prisma.auditLog.findUnique({
        where: { id },
      });

      return log ? this.mapToAuditLog(log) : null;
    } catch (error) {
      this.logger.error(
        'Failed to find audit log by id',
        error instanceof Error ? error : new Error(String(error)),
        {
          id,
          context: 'PrismaAuditRepository.findById',
        },
      );
      throw error;
    }
  }

  async findByTableAndRecord(tableName: string, recordId: string): Promise<AuditLog[]> {
    try {
      const logs = await this.prisma.auditLog.findMany({
        where: {
          tableName,
          recordId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return logs.map((log) => this.mapToAuditLog(log));
    } catch (error) {
      this.logger.error(
        'Failed to find audit logs by table and record',
        error instanceof Error ? error : new Error(String(error)),
        {
          tableName,
          recordId,
          context: 'PrismaAuditRepository.findByTableAndRecord',
        },
      );
      throw error;
    }
  }

  private mapToAuditLog(prismaAuditLog: any): AuditLog {
    return {
      id: prismaAuditLog.id,
      userId: prismaAuditLog.userId || undefined,
      action: prismaAuditLog.action,
      tableName: prismaAuditLog.tableName || undefined,
      recordId: prismaAuditLog.recordId || undefined,
      oldValues: prismaAuditLog.oldValues as Record<string, any> | undefined,
      newValues: prismaAuditLog.newValues as Record<string, any> | undefined,
      ipAddress: prismaAuditLog.ipAddress || undefined,
      userAgent: prismaAuditLog.userAgent || undefined,
      createdAt: prismaAuditLog.createdAt,
    };
  }
}
