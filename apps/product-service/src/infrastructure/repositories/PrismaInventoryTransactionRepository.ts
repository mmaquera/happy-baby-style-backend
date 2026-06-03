import { PrismaClient } from '../../prisma';
import { LoggerFactory, ILogger } from '@hbs/logging';
import {
  IInventoryTransactionRepository,
  InventoryTransaction,
  CreateInventoryTransactionData,
} from '../../domain/repositories/IInventoryTransactionRepository';

export class PrismaInventoryTransactionRepository implements IInventoryTransactionRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaInventoryTransactionRepository',
    );
  }

  async create(data: CreateInventoryTransactionData): Promise<InventoryTransaction> {
    const created = await this.prisma.inventoryTransaction.create({
      data: {
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        reference: data.reference,
        notes: data.notes,
      },
    });
    return this.mapToDto(created);
  }

  async findByProduct(productId: string): Promise<InventoryTransaction[]> {
    const rows = await this.prisma.inventoryTransaction.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapToDto(r));
  }

  private mapToDto(row: any): InventoryTransaction {
    return {
      id: row.id,
      productId: row.productId,
      type: row.type,
      quantity: row.quantity,
      reference: row.reference ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.createdAt,
    };
  }
}
