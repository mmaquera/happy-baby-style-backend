import { PrismaClient } from '@prisma/client';
import type { TokenPayload } from '@hbs/auth';
import type { RecordRuleResolver } from '@hbs/authz';
import { assertWriteAccess } from '@hbs/authz';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type {
  IPaymentMethodRepository,
  PaymentMethodData,
  CreatePaymentMethodInput,
  UpdatePaymentMethodInput,
} from '../../domain/repositories/IPaymentMethodRepository';

export class PrismaPaymentMethodRepository implements IPaymentMethodRepository {
  private readonly logger: ILogger;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly recordRuleResolver?: RecordRuleResolver,
  ) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaPaymentMethodRepository',
    );
  }

  // ---------------------------------------------------------------------------
  // assertOrderWriteAccess
  // ---------------------------------------------------------------------------

  /**
   * Verifies write-side record rules on the PARENT Order before mutating a
   * PaymentMethod. Uses assertWriteAccess from @hbs/authz, which applies the
   * same ambiguous-404 semantics used by PrismaOrderRepository — preventing
   * resource-existence enumeration (BOLA / CWE-639 mitigation).
   */
  async assertOrderWriteAccess(
    orderId: string,
    mode: 'write' | 'unlink',
    currentUser: TokenPayload | null,
  ): Promise<void> {
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Order',
      mode,
      id: orderId,
      currentUser,
      exists: (where) =>
        this.prisma.order
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(input: CreatePaymentMethodInput): Promise<PaymentMethodData> {
    try {
      const pm = await this.prisma.paymentMethod.create({
        data: {
          orderId: input.orderId,
          type: input.type as any,
          amount: input.amount,
          status: input.status ?? 'pending',
          transactionId: input.transactionId ?? null,
          metadata: (input.metadata ?? {}) as any,
        },
      });
      this.logger.info('PaymentMethod created', { paymentMethodId: pm.id, orderId: pm.orderId });
      return this.mapToData(pm);
    } catch (error) {
      this.logger.error(
        'Error creating PaymentMethod',
        error instanceof Error ? error : new Error(String(error)),
        { orderId: input.orderId },
      );
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<PaymentMethodData[]> {
    try {
      const pms = await this.prisma.paymentMethod.findMany({
        where: { order: { userId } },
        orderBy: { createdAt: 'desc' },
      });
      return pms.map((pm) => this.mapToData(pm));
    } catch (error) {
      this.logger.error(
        'Error finding PaymentMethods by userId',
        error instanceof Error ? error : new Error(String(error)),
        { userId },
      );
      throw error;
    }
  }

  async resolveOwnerUserId(paymentMethodId: string): Promise<string | null> {
    try {
      const pm = await this.prisma.paymentMethod.findUnique({
        where: { id: paymentMethodId },
        select: { order: { select: { userId: true } } },
      });
      return pm?.order?.userId ?? null;
    } catch (error) {
      this.logger.error(
        'Error resolving PaymentMethod owner userId',
        error instanceof Error ? error : new Error(String(error)),
        { paymentMethodId },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<PaymentMethodData | null> {
    try {
      const pm = await this.prisma.paymentMethod.findUnique({ where: { id } });
      return pm ? this.mapToData(pm) : null;
    } catch (error) {
      this.logger.error(
        'Error finding PaymentMethod',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async update(id: string, input: UpdatePaymentMethodInput): Promise<PaymentMethodData> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.type !== undefined) updateData['type'] = input.type;
      if (input.amount !== undefined) updateData['amount'] = input.amount;
      if (input.status !== undefined) updateData['status'] = input.status;
      if (input.transactionId !== undefined) updateData['transactionId'] = input.transactionId;
      if (input.metadata !== undefined) updateData['metadata'] = input.metadata;

      const pm = await this.prisma.paymentMethod.update({
        where: { id },
        data: updateData,
      });
      this.logger.info('PaymentMethod updated', { paymentMethodId: id });
      return this.mapToData(pm);
    } catch (error) {
      this.logger.error(
        'Error updating PaymentMethod',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.paymentMethod.delete({ where: { id } });
      this.logger.info('PaymentMethod deleted', { paymentMethodId: id });
      return true;
    } catch (error) {
      this.logger.error(
        'Error deleting PaymentMethod',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Mapper
  // ---------------------------------------------------------------------------

  private mapToData(pm: any): PaymentMethodData {
    return {
      id: pm.id,
      orderId: pm.orderId,
      type: pm.type,
      amount: Number(pm.amount),
      status: pm.status,
      transactionId: pm.transactionId ?? null,
      metadata: pm.metadata as Record<string, unknown>,
      createdAt: pm.createdAt,
      updatedAt: pm.updatedAt,
    };
  }
}
