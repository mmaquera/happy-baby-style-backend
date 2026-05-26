function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface ShippingAddress {
  id: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  createdAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  status: OrderStatus;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  shippingAddressId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  items?: OrderItem[];
  shippingAddress?: ShippingAddress;
}

export interface CreateOrderRequest {
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  items: {
    productId: string;
    quantity: number;
    size: string;
    color: string;
  }[];
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
}

export interface UpdateOrderRequest {
  status?: OrderStatus;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  deliveredAt?: Date;
}

export class OrderEntity implements Order {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly status: OrderStatus,
    public readonly subtotal: number,
    public readonly taxAmount: number,
    public readonly shippingAmount: number,
    public readonly discountAmount: number,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly shippingAddressId?: string,
    public readonly notes?: string,
    public readonly deliveredAt?: Date,
    public readonly items: OrderItem[] = [],
    public readonly shippingAddress?: ShippingAddress
  ) {}

  canBeCancelled(): boolean {
    return ['pending', 'confirmed'].includes(this.status);
  }

  canBeShipped(): boolean {
    return ['confirmed', 'processing'].includes(this.status);
  }

  canBeDelivered(): boolean {
    return this.status === 'shipped';
  }

  getStatusLabel(): string {
    const statusLabels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      processing: 'En Proceso',
      shipped: 'Enviado',
      delivered: 'Entregado',
      cancelled: 'Cancelado'
    };
    return statusLabels[this.status];
  }
}
