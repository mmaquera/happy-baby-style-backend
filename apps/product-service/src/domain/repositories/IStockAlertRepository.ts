export type StockAlertType = 'low_stock' | 'out_of_stock' | 'overstock';

export interface StockAlert {
  id: string;
  productId: string;
  type: StockAlertType;
  threshold: number;
  currentStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStockAlertData {
  productId: string;
  type: StockAlertType;
  threshold: number;
  currentStock: number;
  isActive?: boolean;
}

export interface IStockAlertRepository {
  create(data: CreateStockAlertData): Promise<StockAlert>;
  findById(id: string): Promise<StockAlert | null>;
  findAll(): Promise<StockAlert[]>;
  update(id: string, data: { isActive: boolean }): Promise<StockAlert>;
  delete(id: string): Promise<void>;
}
