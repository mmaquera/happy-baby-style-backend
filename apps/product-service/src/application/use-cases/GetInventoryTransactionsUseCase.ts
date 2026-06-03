import { LoggerFactory } from '@hbs/logging';
import { ValidationError } from '../../domain/errors/DomainError';
import {
  IInventoryTransactionRepository,
  InventoryTransaction,
} from '../../domain/repositories/IInventoryTransactionRepository';

export class GetInventoryTransactionsUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'GetInventoryTransactionsUseCase',
  );

  constructor(private readonly repository: IInventoryTransactionRepository) {}

  async execute(productId: string): Promise<InventoryTransaction[]> {
    if (!productId) throw new ValidationError("Field 'productId' is required");
    return this.repository.findByProduct(productId);
  }
}
