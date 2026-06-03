import { PrismaClient } from '../../prisma';
import {
  ITaxRateRepository,
  TaxRate,
  CreateTaxRateData,
  UpdateTaxRateData,
  TaxRateListParams,
} from '../../domain/repositories/ITaxRateRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class PrismaTaxRateRepository implements ITaxRateRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaTaxRateRepository');
  }

  async create(data: CreateTaxRateData): Promise<TaxRate> {
    try {
      const rate = await this.prisma.taxRate.create({
        data: {
          name: data.name,
          rate: data.rate,
          country: data.country ?? null,
          state: data.state ?? null,
          city: data.city ?? null,
          isActive: data.isActive ?? true,
        },
      });
      return this.mapToTaxRate(rate);
    } catch (error) {
      this.logger.error(
        'Error creating tax rate',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async update(id: string, data: UpdateTaxRateData): Promise<TaxRate> {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData['name'] = data.name;
      if (data.rate !== undefined) updateData['rate'] = data.rate;
      if (data.country !== undefined) updateData['country'] = data.country;
      if (data.state !== undefined) updateData['state'] = data.state;
      if (data.city !== undefined) updateData['city'] = data.city;
      if (data.isActive !== undefined) updateData['isActive'] = data.isActive;

      const rate = await this.prisma.taxRate.update({ where: { id }, data: updateData });
      return this.mapToTaxRate(rate);
    } catch (error) {
      this.logger.error(
        'Error updating tax rate',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.taxRate.delete({ where: { id } });
      return true;
    } catch (error) {
      this.logger.error(
        'Error deleting tax rate',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<TaxRate | null> {
    try {
      const rate = await this.prisma.taxRate.findUnique({ where: { id } });
      return rate ? this.mapToTaxRate(rate) : null;
    } catch (error) {
      this.logger.error(
        'Error finding tax rate',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findAll(params?: TaxRateListParams): Promise<TaxRate[]> {
    try {
      const where: Record<string, unknown> = {};
      if (params?.country !== undefined) where['country'] = params.country;
      if (params?.isActive !== undefined) where['isActive'] = params.isActive;

      const rates = await this.prisma.taxRate.findMany({
        where,
        orderBy: { name: 'asc' },
        take: params?.limit,
        skip: params?.offset,
      });
      return rates.map((r) => this.mapToTaxRate(r));
    } catch (error) {
      this.logger.error(
        'Error listing tax rates',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Returns the first active rate matching the geographic scope.
   *
   * Matching priority (most-specific first):
   *   1. country + state + city (all three)
   *   2. country + state
   *   3. country only
   *   4. null country (fallback / global)
   *
   * Returns null when no active rate matches.
   */
  async findMatchingRate(
    country: string,
    state?: string,
    city?: string,
  ): Promise<TaxRate | null> {
    try {
      // Collect candidates by progressive specificity.  We always pull active rates
      // for the given country plus any global (null country) fallback.
      const candidates = await this.prisma.taxRate.findMany({
        where: {
          isActive: true,
          OR: [{ country }, { country: null }],
        },
        orderBy: { name: 'asc' },
      });

      if (candidates.length === 0) return null;

      // Score: city match = 3, state match = 2, country match = 1, global = 0
      const scored = candidates.map((r) => {
        let score = 0;
        if (r.country === country) score += 1;
        if (state && r.state === state) score += 2;
        if (city && r.city === city) score += 3;
        return { rate: r, score };
      });

      // Sort descending by score; take the highest
      scored.sort((a, b) => b.score - a.score);
      return this.mapToTaxRate(scored[0].rate);
    } catch (error) {
      this.logger.error(
        'Error finding matching tax rate',
        error instanceof Error ? error : new Error(String(error)),
        { country, state, city },
      );
      throw error;
    }
  }

  private mapToTaxRate(prismaRate: {
    id: string;
    name: string;
    rate: unknown;
    country: string | null;
    state: string | null;
    city: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): TaxRate {
    return {
      id: prismaRate.id,
      name: prismaRate.name,
      // Prisma returns Decimal as an object with toString() — serialize to string.
      rate: String(prismaRate.rate),
      country: prismaRate.country,
      state: prismaRate.state,
      city: prismaRate.city,
      isActive: prismaRate.isActive,
      createdAt: prismaRate.createdAt,
      updatedAt: prismaRate.updatedAt,
    };
  }
}
