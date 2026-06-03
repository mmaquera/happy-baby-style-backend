import { PrismaClient } from '../../prisma';
import {
  ICarrierRepository,
  Carrier,
  CreateCarrierData,
  UpdateCarrierData,
  CarrierListParams,
} from '../../domain/repositories/ICarrierRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class PrismaCarrierRepository implements ICarrierRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaCarrierRepository');
  }

  async create(data: CreateCarrierData): Promise<Carrier> {
    try {
      const carrier = await this.prisma.carrier.create({
        data: {
          name: data.name,
          code: data.code,
          trackingUrlTemplate: data.trackingUrlTemplate ?? null,
          isActive: data.isActive ?? true,
        },
      });
      return this.mapToCarrier(carrier);
    } catch (error) {
      this.logger.error(
        'Error creating carrier',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async update(id: string, data: UpdateCarrierData): Promise<Carrier> {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData['name'] = data.name;
      if (data.code !== undefined) updateData['code'] = data.code;
      if (data.trackingUrlTemplate !== undefined)
        updateData['trackingUrlTemplate'] = data.trackingUrlTemplate;
      if (data.isActive !== undefined) updateData['isActive'] = data.isActive;

      const carrier = await this.prisma.carrier.update({
        where: { id },
        data: updateData,
      });
      return this.mapToCarrier(carrier);
    } catch (error) {
      this.logger.error(
        'Error updating carrier',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.carrier.delete({ where: { id } });
      return true;
    } catch (error) {
      this.logger.error(
        'Error deleting carrier',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<Carrier | null> {
    try {
      const carrier = await this.prisma.carrier.findUnique({ where: { id } });
      return carrier ? this.mapToCarrier(carrier) : null;
    } catch (error) {
      this.logger.error(
        'Error finding carrier',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findAll(params?: CarrierListParams): Promise<Carrier[]> {
    try {
      const where: Record<string, unknown> = {};
      if (params?.isActive !== undefined) where['isActive'] = params.isActive;

      const carriers = await this.prisma.carrier.findMany({
        where,
        orderBy: { name: 'asc' },
        take: params?.limit,
        skip: params?.offset,
      });
      return carriers.map((c) => this.mapToCarrier(c));
    } catch (error) {
      this.logger.error(
        'Error listing carriers',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private mapToCarrier(prismaCarrier: {
    id: string;
    name: string;
    code: string;
    trackingUrlTemplate: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Carrier {
    return {
      id: prismaCarrier.id,
      name: prismaCarrier.name,
      code: prismaCarrier.code,
      trackingUrlTemplate: prismaCarrier.trackingUrlTemplate,
      isActive: prismaCarrier.isActive,
      createdAt: prismaCarrier.createdAt,
      updatedAt: prismaCarrier.updatedAt,
    };
  }
}
