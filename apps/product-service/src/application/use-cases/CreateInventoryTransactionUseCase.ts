import { LoggerFactory } from '@hbs/logging';
import { ValidationError } from '../../domain/errors/DomainError';
import {
  IInventoryTransactionRepository,
  InventoryTransaction,
  InventoryTransactionType,
} from '../../domain/repositories/IInventoryTransactionRepository';

export interface CreateInventoryTransactionRequest {
  productId: string;
  type: InventoryTransactionType;
  quantity: number;
  reference?: string;
  notes?: string;
}

export class CreateInventoryTransactionUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'CreateInventoryTransactionUseCase',
  );

  constructor(private readonly repository: IInventoryTransactionRepository) {}

  async execute(request: CreateInventoryTransactionRequest): Promise<InventoryTransaction> {
    const { productId, type, quantity } = request;

    if (!productId) throw new ValidationError("Field 'productId' is required");
    if (!type) throw new ValidationError("Field 'type' is required");
    if (quantity === undefined || quantity === null)
      throw new ValidationError("Field 'quantity' is required");

    const tx = await this.repository.create({
      productId,
      type,
      quantity,
      reference: request.reference,
      notes: request.notes,
    });

    this.logger.info('inventory transaction created', {
      txId: tx.id,
      productId,
      type,
      quantity,
    });

    return tx;
  }
}
