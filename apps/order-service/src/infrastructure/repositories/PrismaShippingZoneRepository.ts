import { PrismaClient } from '../../prisma';
import {
  IShippingZoneRepository,
  ShippingZone,
  CreateShippingZoneData,
  UpdateShippingZoneData,
  ShippingZoneListParams,
} from '../../domain/repositories/IShippingZoneRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class PrismaShippingZoneRepository implements IShippingZoneRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaShippingZoneRepository',
    );
  }

  async create(data: CreateShippingZoneData): Promise<ShippingZone> {
    try {
      const zone = await this.prisma.shippingZone.create({
        data: {
          name: data.name,
          countries: data.countries ?? [],
          states: data.states ?? [],
          cities: data.cities ?? [],
          postalCodes: data.postalCodes ?? [],
          isActive: data.isActive ?? true,
        },
      });
      return this.mapToZone(zone);
    } catch (error) {
      this.logger.error(
        'Error creating shipping zone',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async update(id: string, data: UpdateShippingZoneData): Promise<ShippingZone> {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData['name'] = data.name;
      if (data.countries !== undefined) updateData['countries'] = data.countries;
      if (data.states !== undefined) updateData['states'] = data.states;
      if (data.cities !== undefined) updateData['cities'] = data.cities;
      if (data.postalCodes !== undefined) updateData['postalCodes'] = data.postalCodes;
      if (data.isActive !== undefined) updateData['isActive'] = data.isActive;

      const zone = await this.prisma.shippingZone.update({ where: { id }, data: updateData });
      return this.mapToZone(zone);
    } catch (error) {
      this.logger.error(
        'Error updating shipping zone',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.shippingZone.delete({ where: { id } });
      return true;
    } catch (error) {
      this.logger.error(
        'Error deleting shipping zone',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<ShippingZone | null> {
    try {
      const zone = await this.prisma.shippingZone.findUnique({ where: { id } });
      return zone ? this.mapToZone(zone) : null;
    } catch (error) {
      this.logger.error(
        'Error finding shipping zone',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findAll(params?: ShippingZoneListParams): Promise<ShippingZone[]> {
    try {
      const where: Record<string, unknown> = {};
      if (params?.isActive !== undefined) where['isActive'] = params.isActive;

      const zones = await this.prisma.shippingZone.findMany({
        where,
        orderBy: { name: 'asc' },
        take: params?.limit,
        skip: params?.offset,
      });
      return zones.map((z) => this.mapToZone(z));
    } catch (error) {
      this.logger.error(
        'Error listing shipping zones',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private mapToZone(prismaZone: {
    id: string;
    name: string;
    countries: string[];
    states: string[];
    cities: string[];
    postalCodes: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ShippingZone {
    return {
      id: prismaZone.id,
      name: prismaZone.name,
      countries: prismaZone.countries,
      states: prismaZone.states,
      cities: prismaZone.cities,
      postalCodes: prismaZone.postalCodes,
      isActive: prismaZone.isActive,
      createdAt: prismaZone.createdAt,
      updatedAt: prismaZone.updatedAt,
    };
  }
}
