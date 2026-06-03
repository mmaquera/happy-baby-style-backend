import { LoggerFactory } from '@hbs/logging';
import { IStockAlertRepository, StockAlert } from '../../domain/repositories/IStockAlertRepository';

export class GetStockAlertsUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'GetStockAlertsUseCase',
  );

  constructor(private readonly repository: IStockAlertRepository) {}

  async execute(): Promise<StockAlert[]> {
    return this.repository.findAll();
  }
}
