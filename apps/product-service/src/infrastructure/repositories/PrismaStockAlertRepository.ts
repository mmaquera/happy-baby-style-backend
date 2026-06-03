import { PrismaClient } from '../../prisma';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '../../domain/errors/DomainError';
import {
  IStockAlertRepository,
  StockAlert,
  CreateStockAlertData,
} from '../../domain/repositories/IStockAlertRepository';

export class PrismaStockAlertRepository implements IStockAlertRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaStockAlertRepository',
    );
  }

  async create(data: CreateStockAlertData): Promise<StockAlert> {
    const created = await this.prisma.stockAlert.create({
      data: {
        productId: data.productId,
        type: data.type,
        threshold: data.threshold,
        currentStock: data.currentStock,
        isActive: data.isActive ?? true,
      },
    });
    return this.mapToDto(created);
  }

  async findById(id: string): Promise<StockAlert | null> {
    const row = await this.prisma.stockAlert.findUnique({ where: { id } });
    return row ? this.mapToDto(row) : null;
  }

  async findAll(): Promise<StockAlert[]> {
    const rows = await this.prisma.stockAlert.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.mapToDto(r));
  }

  async update(id: string, data: { isActive: boolean }): Promise<StockAlert> {
    const existing = await this.prisma.stockAlert.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('StockAlert', id);

    const updated = await this.prisma.stockAlert.update({
      where: { id },
      data: { isActive: data.isActive },
    });
    return this.mapToDto(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.stockAlert.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('StockAlert', id);
    await this.prisma.stockAlert.delete({ where: { id } });
  }

  private mapToDto(row: any): StockAlert {
    return {
      id: row.id,
      productId: row.productId,
      type: row.type,
      threshold: row.threshold,
      currentStock: row.currentStock,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
