import { LoggerFactory } from '@hbs/logging';
import { ValidationError } from '../../domain/errors/DomainError';
import { IStockAlertRepository, StockAlert } from '../../domain/repositories/IStockAlertRepository';

export class UpdateStockAlertUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'UpdateStockAlertUseCase',
  );

  constructor(private readonly repository: IStockAlertRepository) {}

  async execute(id: string, isActive: boolean): Promise<StockAlert> {
    if (!id) throw new ValidationError("Field 'id' is required");
    if (isActive === undefined || isActive === null)
      throw new ValidationError("Field 'isActive' is required");

    const updated = await this.repository.update(id, { isActive });

    this.logger.info('stock alert updated', { alertId: id, isActive });

    return updated;
  }
}
