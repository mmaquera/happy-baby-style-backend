// Función para generar UUID simple
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Tipos de productos
export type ProductSize = 'recien_nacido' | '3_meses' | '6_meses' | '9_meses' | '12_meses' | '18_meses' | '24_meses';
export type ProductColor = 'blanco' | 'rosa_suave' | 'azul_cielo' | 'amarillo_pastel' | 'verde_menta' | 'gris_perla';

// Tipos de estado de pedido
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

// Entidad de dirección de envío
export interface ShippingAddress {
  id: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Entidad de item de pedido
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  size: ProductSize;
  color: ProductColor;
  createdAt: Date;
}

// Entidad principal de pedido
export interface Order {
  id: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  status: OrderStatus;
  total: number;
  shippingAddressId: string;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  items?: OrderItem[];
  shippingAddress?: ShippingAddress;
}

// DTOs para operaciones
export interface CreateOrderRequest {
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  items: {
    productId: string;
    quantity: number;
    size: ProductSize;
    color: ProductColor;
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

// Clase de entidad Order
export class OrderEntity implements Order {
  constructor(
    public readonly id: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly customerPhone: string | undefined,
    public readonly status: OrderStatus,
    public readonly total: number,
    public readonly shippingAddressId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deliveredAt: Date | undefined,
    public readonly items: OrderItem[] = [],
    public readonly shippingAddress: ShippingAddress | undefined = undefined
  ) {}

  static create(data: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'deliveredAt'>): OrderEntity {
    const now = new Date();
    return new OrderEntity(
      generateId(),
      data.customerEmail,
      data.customerName,
      data.customerPhone,
      data.status,
      data.total,
      data.shippingAddressId,
      now,
      now,
      undefined,
      data.items,
      data.shippingAddress
    );
  }

  update(data: UpdateOrderRequest): OrderEntity {
    return new OrderEntity(
      this.id,
      data.customerEmail ?? this.customerEmail,
      data.customerName ?? this.customerName,
      data.customerPhone ?? this.customerPhone,
      data.status ?? this.status,
      this.total,
      this.shippingAddressId,
      this.createdAt,
      new Date(),
      data.deliveredAt ?? this.deliveredAt,
      this.items,
      this.shippingAddress
    );
  }

  updateStatus(status: OrderStatus): OrderEntity {
    const deliveredAt = status === 'delivered' ? new Date() : this.deliveredAt;
    
    return new OrderEntity(
      this.id,
      this.customerEmail,
      this.customerName,
      this.customerPhone,
      status,
      this.total,
      this.shippingAddressId,
      this.createdAt,
      new Date(),
      deliveredAt,
      this.items,
      this.shippingAddress
    );
  }

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

// Clase de entidad OrderItem
export class OrderItemEntity implements OrderItem {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly price: number,
    public readonly size: ProductSize,
    public readonly color: ProductColor,
    public readonly createdAt: Date
  ) {}

  static create(data: Omit<OrderItem, 'id' | 'createdAt'>): OrderItemEntity {
    const now = new Date();
    return new OrderItemEntity(
      generateId(),
      data.orderId,
      data.productId,
      data.quantity,
      data.price,
      data.size,
      data.color,
      now
    );
  }

  calculateTotal(): number {
    return this.price * this.quantity;
  }
}

// Clase de entidad ShippingAddress
export class ShippingAddressEntity implements ShippingAddress {
  constructor(
    public readonly id: string,
    public readonly street: string,
    public readonly city: string,
    public readonly state: string,
    public readonly zipCode: string,
    public readonly country: string
  ) {}

  static create(data: Omit<ShippingAddress, 'id'>): ShippingAddressEntity {
    return new ShippingAddressEntity(
      generateId(),
      data.street,
      data.city,
      data.state,
      data.zipCode,
      data.country
    );
  }

  getFullAddress(): string {
    return `${this.street}, ${this.city}, ${this.state} ${this.zipCode}, ${this.country}`;
  }
}