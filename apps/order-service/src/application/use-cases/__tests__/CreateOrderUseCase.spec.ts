jest.mock(
  '@hbs/logging',
  () => ({
    LoggerFactory: {
      getInstance: () => ({
        createUseCaseLogger: () => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }),
      }),
    },
  }),
  { virtual: true },
);

import { CreateOrderUseCase } from '../CreateOrderUseCase';
import type { IOrderRepository } from '../../../domain/repositories/IOrderRepository';
import type { IProductValidationPort, ProductInfo } from '../../../domain/ports/IProductValidationPort';
import type { IEventPublisher } from '../../../domain/ports/IEventPublisher';
import type { Order, CreateOrderRequest } from '../../../domain/entities/Order';

const makeProduct = (overrides: Partial<ProductInfo> = {}): ProductInfo => ({
  id: 'prod-1',
  name: 'Pijama Bebé',
  isActive: true,
  price: 29.99,
  stockQuantity: 10,
  variants: [
    { id: 'var-1', size: 'M', color: 'blue', stockQuantity: 5, price: 29.99, isActive: true },
  ],
  ...overrides,
});

const makeOrder = (): Order => ({
  id: 'ord-1',
  userId: 'user-1',
  orderNumber: 'ORD-001',
  customerEmail: 'test@test.com',
  customerName: 'Test User',
  status: 'pending',
  subtotal: 59.98,
  taxAmount: 0,
  shippingAmount: 0,
  discountAmount: 0,
  totalAmount: 59.98,
  currency: 'USD',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeRequest = (): CreateOrderRequest => ({
  customerEmail: 'test@test.com',
  customerName: 'Test User',
  items: [{ productId: 'prod-1', quantity: 2, size: 'M', color: 'blue' }],
  shippingAddress: { street: '123 Main St', city: 'Lima', state: 'Lima', zipCode: '15001' },
});

const makeRepo = (): jest.Mocked<IOrderRepository> =>
  ({ create: jest.fn().mockResolvedValue(makeOrder()) } as any);

const makeValidation = (product: ProductInfo | null = makeProduct()): jest.Mocked<IProductValidationPort> =>
  ({ getProductById: jest.fn().mockResolvedValue(product) } as any);

const makePublisher = (): jest.Mocked<IEventPublisher> =>
  ({ publishOrderCreated: jest.fn().mockResolvedValue(undefined) } as any);

describe('CreateOrderUseCase', () => {
  it('throws when product is not found', async () => {
    const uc = new CreateOrderUseCase(makeRepo(), makeValidation(null), makePublisher());
    await expect(uc.execute(makeRequest())).rejects.toThrow('not found');
  });

  it('throws when product is inactive', async () => {
    const uc = new CreateOrderUseCase(makeRepo(), makeValidation(makeProduct({ isActive: false })), makePublisher());
    await expect(uc.execute(makeRequest())).rejects.toThrow('not active');
  });

  it('throws when product stock is insufficient', async () => {
    const uc = new CreateOrderUseCase(makeRepo(), makeValidation(makeProduct({ stockQuantity: 1 })), makePublisher());
    await expect(uc.execute(makeRequest())).rejects.toThrow('Insufficient stock');
  });

  it('throws when variant is not found', async () => {
    const product = makeProduct({ variants: [] });
    const uc = new CreateOrderUseCase(makeRepo(), makeValidation(product), makePublisher());
    await expect(uc.execute(makeRequest())).rejects.toThrow('not available');
  });

  it('throws when variant stock is insufficient', async () => {
    const product = makeProduct({
      variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 1, price: 29.99, isActive: true }],
    });
    const uc = new CreateOrderUseCase(makeRepo(), makeValidation(product), makePublisher());
    await expect(uc.execute(makeRequest())).rejects.toThrow('Insufficient variant stock');
  });

  it('creates order and publishes event on success', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    const uc = new CreateOrderUseCase(repo, makeValidation(), publisher);

    const result = await uc.execute(makeRequest());

    expect(result.id).toBe('ord-1');
    expect(repo.create).toHaveBeenCalledWith(makeRequest(), 59.98);
    expect(publisher.publishOrderCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ord-1',
        items: [expect.objectContaining({ productId: 'prod-1', variantId: 'var-1', quantity: 2 })],
      }),
    );
  });

  it('still returns the order when event publishing fails', async () => {
    const publisher = makePublisher();
    publisher.publishOrderCreated.mockRejectedValue(new Error('Redis down'));
    const uc = new CreateOrderUseCase(makeRepo(), makeValidation(), publisher);

    const result = await uc.execute(makeRequest());

    expect(result.id).toBe('ord-1');
  });
});
