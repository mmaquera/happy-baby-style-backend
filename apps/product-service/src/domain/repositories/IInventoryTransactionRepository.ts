export type InventoryTransactionType =
  | 'purchase'
  | 'sale'
  | 'return'
  | 'adjustment'
  | 'transfer';

export interface InventoryTransaction {
  id: string;
  productId: string;
  type: InventoryTransactionType;
  quantity: number;
  reference?: string;
  notes?: string;
  createdAt: Date;
}

export interface CreateInventoryTransactionData {
  productId: string;
  type: InventoryTransactionType;
  quantity: number;
  reference?: string;
  notes?: string;
}

export interface IInventoryTransactionRepository {
  create(data: CreateInventoryTransactionData): Promise<InventoryTransaction>;
  findByProduct(productId: string): Promise<InventoryTransaction[]>;
}
