import { ISavedPaymentMethodRepository } from '@domain/repositories/ISavedPaymentMethodRepository';
import {
  SavedPaymentMethod,
  CreateSavedPaymentMethodRequest,
  UpdateSavedPaymentMethodRequest,
  PaymentMethodType,
} from '@domain/entities/Payment';
import { PrismaClient } from '../../prisma';
import { NotFoundError } from '@domain/errors/DomainError';
import { LoggerFactory } from '@hbs/logging';

export class PrismaSavedPaymentMethodRepository implements ISavedPaymentMethodRepository {
  private readonly logger = LoggerFactory.getInstance().createRepositoryLogger(
    'PrismaSavedPaymentMethodRepository',
  );

  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(
    userId: string,
    includeInactive = false,
  ): Promise<SavedPaymentMethod[]> {
    const rows = await this.prisma.savedPaymentMethod.findMany({
      where: includeInactive ? { userId } : { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.toDomain);
  }

  async findById(id: string, includeInactive = false): Promise<SavedPaymentMethod | null> {
    const row = await this.prisma.savedPaymentMethod.findUnique({ where: { id } });
    if (!row) return null;
    if (!includeInactive && !row.isActive) return null;
    return this.toDomain(row);
  }

  async findDefaultByUserId(userId: string): Promise<SavedPaymentMethod | null> {
    const row = await this.prisma.savedPaymentMethod.findFirst({
      where: { userId, isDefault: true, isActive: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async create(data: CreateSavedPaymentMethodRequest): Promise<SavedPaymentMethod> {
    // If this will be the default, clear the previous one inside a transaction.
    if (data.isDefault) {
      const created = await this.prisma.$transaction(async (tx) => {
        await tx.savedPaymentMethod.updateMany({
          where: { userId: data.userId, isDefault: true },
          data: { isDefault: false },
        });
        return tx.savedPaymentMethod.create({
          data: {
            userId: data.userId,
            type: data.type,
            provider: data.provider,
            lastFour: data.lastFour,
            expiryMonth: data.expiryMonth,
            expiryYear: data.expiryYear,
            cardholderName: data.cardholderName,
            isDefault: true,
            isActive: true,
            metadata: (data.metadata ?? {}) as any,
          },
        });
      });
      this.logger.info('SavedPaymentMethod created (default swapped)', {
        id: created.id,
        userId: data.userId,
      });
      return this.toDomain(created);
    }

    const created = await this.prisma.savedPaymentMethod.create({
      data: {
        userId: data.userId,
        type: data.type,
        provider: data.provider,
        lastFour: data.lastFour,
        expiryMonth: data.expiryMonth,
        expiryYear: data.expiryYear,
        cardholderName: data.cardholderName,
        isDefault: false,
        isActive: true,
        metadata: (data.metadata ?? {}) as any,
      },
    });
    this.logger.info('SavedPaymentMethod created', { id: created.id, userId: data.userId });
    return this.toDomain(created);
  }

  async update(id: string, data: UpdateSavedPaymentMethodRequest): Promise<SavedPaymentMethod> {
    const existing = await this.prisma.savedPaymentMethod.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('SavedPaymentMethod', id);

    if (data.isDefault) {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.savedPaymentMethod.updateMany({
          where: { userId: existing.userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        return tx.savedPaymentMethod.update({
          where: { id },
          data: {
            ...(data.cardholderName !== undefined && { cardholderName: data.cardholderName }),
            ...(data.expiryMonth !== undefined && { expiryMonth: data.expiryMonth }),
            ...(data.expiryYear !== undefined && { expiryYear: data.expiryYear }),
            ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
            ...(data.metadata !== undefined && { metadata: data.metadata as any }),
          } as any,
        });
      });
      return this.toDomain(updated);
    }

    const updated = await this.prisma.savedPaymentMethod.update({
      where: { id },
      data: {
        ...(data.cardholderName !== undefined && { cardholderName: data.cardholderName }),
        ...(data.expiryMonth !== undefined && { expiryMonth: data.expiryMonth }),
        ...(data.expiryYear !== undefined && { expiryYear: data.expiryYear }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.metadata !== undefined && { metadata: data.metadata as any }),
      } as any,
    });
    return this.toDomain(updated);
  }

  async deactivate(id: string): Promise<SavedPaymentMethod> {
    const existing = await this.prisma.savedPaymentMethod.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('SavedPaymentMethod', id);

    const updated = await this.prisma.savedPaymentMethod.update({
      where: { id },
      data: {
        isActive: false,
        // If it was the default, clear that flag too — a deactivated method should not remain default.
        ...(existing.isDefault && { isDefault: false }),
      },
    });
    this.logger.info('SavedPaymentMethod deactivated (soft-delete)', { id });
    return this.toDomain(updated);
  }

  async setDefault(userId: string, id: string): Promise<SavedPaymentMethod> {
    const existing = await this.prisma.savedPaymentMethod.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId || !existing.isActive) {
      throw new NotFoundError('SavedPaymentMethod', id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.savedPaymentMethod.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      return tx.savedPaymentMethod.update({
        where: { id },
        data: { isDefault: true },
      });
    });
    this.logger.info('SavedPaymentMethod set as default', { id, userId });
    return this.toDomain(updated);
  }

  private toDomain(row: any): SavedPaymentMethod {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type as PaymentMethodType,
      provider: row.provider,
      lastFour: row.lastFour ?? undefined,
      expiryMonth: row.expiryMonth ?? undefined,
      expiryYear: row.expiryYear ?? undefined,
      cardholderName: row.cardholderName ?? undefined,
      isDefault: row.isDefault,
      isActive: row.isActive,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
