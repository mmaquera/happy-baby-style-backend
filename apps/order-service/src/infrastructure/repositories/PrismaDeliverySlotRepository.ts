import { PrismaClient } from '../../prisma';
import {
  IDeliverySlotRepository,
  DeliverySlot,
  CreateDeliverySlotData,
  UpdateDeliverySlotData,
  DeliverySlotListParams,
} from '../../domain/repositories/IDeliverySlotRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class PrismaDeliverySlotRepository implements IDeliverySlotRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaDeliverySlotRepository',
    );
  }

  async create(data: CreateDeliverySlotData): Promise<DeliverySlot> {
    try {
      const slot = await this.prisma.deliverySlot.create({
        data: {
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          maxOrders: data.maxOrders,
          isActive: data.isActive ?? true,
        },
      });
      return this.mapToSlot(slot);
    } catch (error) {
      this.logger.error(
        'Error creating delivery slot',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async update(id: string, data: UpdateDeliverySlotData): Promise<DeliverySlot> {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.dayOfWeek !== undefined) updateData['dayOfWeek'] = data.dayOfWeek;
      if (data.startTime !== undefined) updateData['startTime'] = data.startTime;
      if (data.endTime !== undefined) updateData['endTime'] = data.endTime;
      if (data.maxOrders !== undefined) updateData['maxOrders'] = data.maxOrders;
      if (data.isActive !== undefined) updateData['isActive'] = data.isActive;

      const slot = await this.prisma.deliverySlot.update({ where: { id }, data: updateData });
      return this.mapToSlot(slot);
    } catch (error) {
      this.logger.error(
        'Error updating delivery slot',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.deliverySlot.delete({ where: { id } });
      return true;
    } catch (error) {
      this.logger.error(
        'Error deleting delivery slot',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<DeliverySlot | null> {
    try {
      const slot = await this.prisma.deliverySlot.findUnique({ where: { id } });
      return slot ? this.mapToSlot(slot) : null;
    } catch (error) {
      this.logger.error(
        'Error finding delivery slot',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findAll(params?: DeliverySlotListParams): Promise<DeliverySlot[]> {
    try {
      const where: Record<string, unknown> = {};
      if (params?.dayOfWeek !== undefined) where['dayOfWeek'] = params.dayOfWeek;
      if (params?.isActive !== undefined) where['isActive'] = params.isActive;

      const slots = await this.prisma.deliverySlot.findMany({
        where,
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        take: params?.limit,
        skip: params?.offset,
      });
      return slots.map((s) => this.mapToSlot(s));
    } catch (error) {
      this.logger.error(
        'Error listing delivery slots',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findByDayOfWeek(dayOfWeek: number): Promise<DeliverySlot[]> {
    try {
      const slots = await this.prisma.deliverySlot.findMany({
        where: { dayOfWeek, isActive: true },
        orderBy: { startTime: 'asc' },
      });
      return slots.map((s) => this.mapToSlot(s));
    } catch (error) {
      this.logger.error(
        'Error finding delivery slots by day',
        error instanceof Error ? error : new Error(String(error)),
        { dayOfWeek },
      );
      throw error;
    }
  }

  private mapToSlot(prismaSlot: {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    maxOrders: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): DeliverySlot {
    return {
      id: prismaSlot.id,
      dayOfWeek: prismaSlot.dayOfWeek,
      startTime: prismaSlot.startTime,
      endTime: prismaSlot.endTime,
      maxOrders: prismaSlot.maxOrders,
      isActive: prismaSlot.isActive,
      createdAt: prismaSlot.createdAt,
      updatedAt: prismaSlot.updatedAt,
    };
  }
}
