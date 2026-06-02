import { PrismaClient } from '@prisma/client';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type {
  ITransactionRepository,
  TransactionData,
} from '../../domain/repositories/ITransactionRepository';

export class PrismaTransactionRepository implements ITransactionRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaTransactionRepository',
    );
  }

  async findByUserId(userId: string): Promise<TransactionData[]> {
    try {
      const txs = await this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return txs.map((t) => this.mapToData(t));
    } catch (error) {
      this.logger.error(
        'Error finding Transactions by userId',
        error instanceof Error ? error : new Error(String(error)),
        { userId },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<TransactionData | null> {
    try {
      const tx = await this.prisma.transaction.findUnique({ where: { id } });
      return tx ? this.mapToData(tx) : null;
    } catch (error) {
      this.logger.error(
        'Error finding Transaction by id',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async resolveOwnerUserId(transactionId: string): Promise<string | null> {
    try {
      const tx = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        select: { userId: true },
      });
      return tx?.userId ?? null;
    } catch (error) {
      this.logger.error(
        'Error resolving Transaction owner userId',
        error instanceof Error ? error : new Error(String(error)),
        { transactionId },
      );
      throw error;
    }
  }

  private mapToData(tx: any): TransactionData {
    return {
      id: tx.id,
      orderId: tx.orderId,
      userId: tx.userId,
      type: tx.type,
      amount: Number(tx.amount),
      currency: tx.currency,
      status: tx.status,
      gateway: tx.gateway ?? null,
      gatewayTransactionId: tx.gatewayTransactionId ?? null,
      metadata: tx.metadata as Record<string, unknown>,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  }
}
