import { PrismaClient } from '@prisma/client';
import { ISecurityEventRepository } from '@domain/repositories/ISecurityEventRepository';
import { SecurityEvent, CreateSecurityEventRequest } from '@domain/entities/Audit';
import { ILogger } from '@hbs/logging';
import { LoggerFactory } from '@hbs/logging';

/**
 * Repositorio de infraestructura para eventos de seguridad usando Prisma
 *
 * Principios aplicados:
 * - Clean Architecture: Implementación en la capa de infraestructura
 * - Dependency Inversion: Implementa ISecurityEventRepository del dominio
 * - Single Responsibility: Solo maneja operaciones de eventos de seguridad
 */
export class PrismaSecurityEventRepository implements ISecurityEventRepository {
  private readonly logger: ILogger;

  constructor(private prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaSecurityEventRepository',
    );
  }

  async create(data: CreateSecurityEventRequest): Promise<SecurityEvent> {
    const startTime = Date.now();

    try {
      this.logger.debug('Creating security event', {
        eventType: data.eventType,
        userId: data.userId,
        description: data.description,
        context: 'PrismaSecurityEventRepository.create',
      });

      const created = await this.prisma.securityEvent.create({
        data: {
          userId: data.userId || null,
          eventType: data.eventType,
          description: data.description,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : {},
        },
      });

      const duration = Date.now() - startTime;

      this.logger.info('Security event created successfully', {
        securityEventId: created.id,
        eventType: created.eventType,
        duration,
        context: 'PrismaSecurityEventRepository.create',
      });

      return this.mapToSecurityEvent(created);
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(
        'Failed to create security event',
        error instanceof Error ? error : new Error(String(error)),
        {
          eventType: data.eventType,
          userId: data.userId,
          duration,
          context: 'PrismaSecurityEventRepository.create',
        },
      );

      throw error;
    }
  }

  async findByUserId(userId: string): Promise<SecurityEvent[]> {
    try {
      const events = await this.prisma.securityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return events.map((event) => this.mapToSecurityEvent(event));
    } catch (error) {
      this.logger.error(
        'Failed to find security events by user id',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId,
          context: 'PrismaSecurityEventRepository.findByUserId',
        },
      );
      throw error;
    }
  }

  async findByEventType(eventType: string, limit: number = 100): Promise<SecurityEvent[]> {
    try {
      const events = await this.prisma.securityEvent.findMany({
        where: { eventType },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return events.map((event) => this.mapToSecurityEvent(event));
    } catch (error) {
      this.logger.error(
        'Failed to find security events by event type',
        error instanceof Error ? error : new Error(String(error)),
        {
          eventType,
          limit,
          context: 'PrismaSecurityEventRepository.findByEventType',
        },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<SecurityEvent | null> {
    try {
      const event = await this.prisma.securityEvent.findUnique({
        where: { id },
      });

      return event ? this.mapToSecurityEvent(event) : null;
    } catch (error) {
      this.logger.error(
        'Failed to find security event by id',
        error instanceof Error ? error : new Error(String(error)),
        {
          id,
          context: 'PrismaSecurityEventRepository.findById',
        },
      );
      throw error;
    }
  }

  async findRecent(limit: number = 100): Promise<SecurityEvent[]> {
    try {
      const events = await this.prisma.securityEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return events.map((event) => this.mapToSecurityEvent(event));
    } catch (error) {
      this.logger.error(
        'Failed to find recent security events',
        error instanceof Error ? error : new Error(String(error)),
        {
          limit,
          context: 'PrismaSecurityEventRepository.findRecent',
        },
      );
      throw error;
    }
  }

  private mapToSecurityEvent(prismaSecurityEvent: any): SecurityEvent {
    return {
      id: prismaSecurityEvent.id,
      userId: prismaSecurityEvent.userId || undefined,
      eventType: prismaSecurityEvent.eventType,
      description: prismaSecurityEvent.description,
      ipAddress: prismaSecurityEvent.ipAddress || undefined,
      userAgent: prismaSecurityEvent.userAgent || undefined,
      metadata: prismaSecurityEvent.metadata as Record<string, any>,
      createdAt: prismaSecurityEvent.createdAt,
    };
  }
}
