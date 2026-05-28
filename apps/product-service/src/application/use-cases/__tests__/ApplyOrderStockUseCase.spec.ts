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

import { Prisma } from '@prisma/client';
import { ApplyOrderStockUseCase, OrderCreatedEvent } from '../ApplyOrderStockUseCase';

const event: OrderCreatedEvent = {
  eventId: 'evt-1',
  orderId: 'ord-1',
  orderNumber: 'NUM-1',
  createdAt: new Date().toISOString(),
  items: [
    { productId: 'p1', variantId: 'v1', variantSize: 'M', variantColor: 'red', quantity: 2 },
  ],
};

describe('ApplyOrderStockUseCase', () => {
  it('decrements variant and product stock and records the event on first delivery', async () => {
    const tx = {
      inboxEvent: { create: jest.fn().mockResolvedValue({}) },
      productVariant: { update: jest.fn().mockResolvedValue({}) },
      product: { update: jest.fn().mockResolvedValue({}) },
      inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn(async (cb: any) => cb(tx)) } as any;

    const result = await new ApplyOrderStockUseCase(prisma).execute(event);

    expect(result).toEqual({ applied: true });
    expect(tx.inboxEvent.create).toHaveBeenCalledWith({ data: { eventId: 'evt-1' } });
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { stockQuantity: { decrement: 2 } },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stockQuantity: { decrement: 2 } },
    });
    expect(tx.inventoryTransaction.create).toHaveBeenCalledWith({
      data: { productId: 'p1', type: 'sale', quantity: 2, reference: 'ord-1', notes: 'v1' },
    });
  });

  it('is idempotent: skips when the event was already processed (P2002)', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    } as any);
    const prisma = { $transaction: jest.fn().mockRejectedValue(duplicate) } as any;

    const result = await new ApplyOrderStockUseCase(prisma).execute(event);

    expect(result).toEqual({ applied: false, reason: 'duplicate' });
  });

  it('rethrows unexpected errors so the entry stays pending', async () => {
    const prisma = { $transaction: jest.fn().mockRejectedValue(new Error('boom')) } as any;

    await expect(new ApplyOrderStockUseCase(prisma).execute(event)).rejects.toThrow('boom');
  });
});
