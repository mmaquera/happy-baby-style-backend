import { PrismaClient } from '../../prisma';
import {
  IShippingRateRepository,
  ShippingRate,
  CreateShippingRateData,
  UpdateShippingRateData,
  ShippingRateListParams,
} from '../../domain/repositories/IShippingRateRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class PrismaShippingRateRepository implements IShippingRateRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaShippingRateRepository',
    );
  }

  async create(data: CreateShippingRateData): Promise<ShippingRate> {
    try {
      const rate = await this.prisma.shippingRate.create({
        data: {
          zoneId: data.zoneId,
          name: data.name,
          minWeight: data.minWeight !== undefined ? data.minWeight : null,
          maxWeight: data.maxWeight !== undefined ? data.maxWeight : null,
          price: data.price,
          isActive: data.isActive ?? true,
        },
      });
      return this.mapToRate(rate);
    } catch (error) {
      this.logger.error(
        'Error creating shipping rate',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async update(id: string, data: UpdateShippingRateData): Promise<ShippingRate> {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData['name'] = data.name;
      if (data.minWeight !== undefined) updateData['minWeight'] = data.minWeight;
      if (data.maxWeight !== undefined) updateData['maxWeight'] = data.maxWeight;
      if (data.price !== undefined) updateData['price'] = data.price;
      if (data.isActive !== undefined) updateData['isActive'] = data.isActive;

      const rate = await this.prisma.shippingRate.update({ where: { id }, data: updateData });
      return this.mapToRate(rate);
    } catch (error) {
      this.logger.error(
        'Error updating shipping rate',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.shippingRate.delete({ where: { id } });
      return true;
    } catch (error) {
      this.logger.error(
        'Error deleting shipping rate',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<ShippingRate | null> {
    try {
      const rate = await this.prisma.shippingRate.findUnique({ where: { id } });
      return rate ? this.mapToRate(rate) : null;
    } catch (error) {
      this.logger.error(
        'Error finding shipping rate',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findAll(params?: ShippingRateListParams): Promise<ShippingRate[]> {
    try {
      const where: Record<string, unknown> = {};
      if (params?.zoneId !== undefined) where['zoneId'] = params.zoneId;
      if (params?.isActive !== undefined) where['isActive'] = params.isActive;

      const rates = await this.prisma.shippingRate.findMany({
        where,
        orderBy: { price: 'asc' },
        take: params?.limit,
        skip: params?.offset,
      });
      return rates.map((r) => this.mapToRate(r));
    } catch (error) {
      this.logger.error(
        'Error listing shipping rates',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findByZoneId(zoneId: string): Promise<ShippingRate[]> {
    try {
      const rates = await this.prisma.shippingRate.findMany({
        where: { zoneId, isActive: true },
        orderBy: { price: 'asc' },
      });
      return rates.map((r) => this.mapToRate(r));
    } catch (error) {
      this.logger.error(
        'Error finding shipping rates by zone',
        error instanceof Error ? error : new Error(String(error)),
        { zoneId },
      );
      throw error;
    }
  }

  private mapToRate(prismaRate: {
    id: string;
    zoneId: string;
    name: string;
    minWeight: unknown;
    maxWeight: unknown;
    price: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ShippingRate {
    return {
      id: prismaRate.id,
      zoneId: prismaRate.zoneId,
      name: prismaRate.name,
      // Prisma returns Decimal as an object with toString() — serialize to string
      // to avoid float precision loss (domain interface uses string for Decimal fields).
      minWeight:
        prismaRate.minWeight != null ? String(prismaRate.minWeight) : null,
      maxWeight:
        prismaRate.maxWeight != null ? String(prismaRate.maxWeight) : null,
      price: String(prismaRate.price),
      isActive: prismaRate.isActive,
      createdAt: prismaRate.createdAt,
      updatedAt: prismaRate.updatedAt,
    };
  }
}
