import { LoggerFactory } from '@hbs/logging';
import { ValidationError } from '../../domain/errors/DomainError';
import {
  IStockAlertRepository,
  StockAlert,
  StockAlertType,
} from '../../domain/repositories/IStockAlertRepository';

export interface CreateStockAlertRequest {
  productId: string;
  type: StockAlertType;
  threshold: number;
  currentStock: number;
  isActive?: boolean;
}

export class CreateStockAlertUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'CreateStockAlertUseCase',
  );

  constructor(private readonly repository: IStockAlertRepository) {}

  async execute(request: CreateStockAlertRequest): Promise<StockAlert> {
    const { productId, type, threshold, currentStock } = request;

    if (!productId) throw new ValidationError("Field 'productId' is required");
    if (!type) throw new ValidationError("Field 'type' is required");
    if (threshold === undefined || threshold === null)
      throw new ValidationError("Field 'threshold' is required");
    if (threshold < 0) throw new ValidationError("Field 'threshold' must be non-negative");
    if (currentStock === undefined || currentStock === null)
      throw new ValidationError("Field 'currentStock' is required");

    const alert = await this.repository.create({
      productId,
      type,
      threshold,
      currentStock,
      isActive: request.isActive ?? true,
    });

    this.logger.info('stock alert created', {
      alertId: alert.id,
      productId,
      type,
    });

    return alert;
  }
}
