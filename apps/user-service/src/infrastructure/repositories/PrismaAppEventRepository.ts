import { IAppEventRepository } from '@domain/repositories/IAppEventRepository';
import { AppEvent, CreateAppEventRequest } from '@domain/entities/Analytics';
import { PrismaClient } from '../../prisma';
import { LoggerFactory } from '@hbs/logging';

export class PrismaAppEventRepository implements IAppEventRepository {
  private readonly logger = LoggerFactory.getInstance().createRepositoryLogger(
    'PrismaAppEventRepository',
  );

  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string, limit: number): Promise<AppEvent[]> {
    const rows = await this.prisma.appEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(this.toDomain);
  }

  async findByProductId(productId: string, limit: number): Promise<AppEvent[]> {
    const rows = await this.prisma.appEvent.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(this.toDomain);
  }

  async findByUserIdAndType(
    userId: string,
    eventType: string,
    limit: number,
  ): Promise<AppEvent[]> {
    const rows = await this.prisma.appEvent.findMany({
      where: { userId, eventType },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(this.toDomain);
  }

  async create(data: CreateAppEventRequest): Promise<AppEvent> {
    const row = await this.prisma.appEvent.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        eventType: data.eventType,
        eventData: (data.eventData ?? {}) as any,
        productId: data.productId,
        categoryId: data.categoryId,
        deviceInfo: (data.deviceInfo ?? {}) as any,
        location: (data.location ?? {}) as any,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    });
    this.logger.info('AppEvent created', { id: row.id, eventType: data.eventType });
    return this.toDomain(row);
  }

  private toDomain(row: any): AppEvent {
    return {
      id: row.id,
      userId: row.userId ?? undefined,
      sessionId: row.sessionId ?? undefined,
      eventType: row.eventType,
      eventData: (row.eventData as Record<string, unknown>) ?? undefined,
      productId: row.productId ?? undefined,
      categoryId: row.categoryId ?? undefined,
      deviceInfo: (row.deviceInfo as Record<string, unknown>) ?? undefined,
      location: (row.location as Record<string, unknown>) ?? undefined,
      userAgent: row.userAgent ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      createdAt: row.createdAt,
    };
  }
}
