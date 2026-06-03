import { LoggerFactory } from '@hbs/logging';
import { ValidationError } from '../../domain/errors/DomainError';
import { IStockAlertRepository } from '../../domain/repositories/IStockAlertRepository';

export class DeleteStockAlertUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'DeleteStockAlertUseCase',
  );

  constructor(private readonly repository: IStockAlertRepository) {}

  async execute(id: string): Promise<void> {
    if (!id) throw new ValidationError("Field 'id' is required");
    await this.repository.delete(id);
    this.logger.info('stock alert deleted', { alertId: id });
  }
}
