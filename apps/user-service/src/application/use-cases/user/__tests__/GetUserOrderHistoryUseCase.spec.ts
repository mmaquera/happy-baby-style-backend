jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import {
  GetUserOrderHistoryUseCase,
  IUserOrderRepository,
  UserOrderHistoryRequest,
} from '../GetUserOrderHistoryUseCase';

function makeOrderStats() {
  return {
    totalOrders: 5,
    totalSpent: 500,
    averageOrderValue: 100,
    lastOrderDate: new Date(),
  };
}

function makeRepo(overrides: Partial<IUserOrderRepository> = {}): jest.Mocked<IUserOrderRepository> {
  return {
    getUserOrders: jest.fn().mockResolvedValue({
      orders: [{ id: 'ord-1', status: 'pending' }],
      total: 1,
    }),
    getUserOrderStats: jest.fn().mockResolvedValue(makeOrderStats()),
    ...overrides,
  } as any;
}

describe('GetUserOrderHistoryUseCase', () => {
  describe('execute', () => {
    it('returns orders and stats for a valid userId', async () => {
      const repo = makeRepo();
      const uc = new GetUserOrderHistoryUseCase(repo);
      const result = await uc.execute({ userId: 'user-1' });
      expect(result.orders).toHaveLength(1);
      expect(result.stats.totalOrders).toBe(5);
      expect(result.hasMore).toBe(false);
    });

    it('throws when userId is missing', async () => {
      const repo = makeRepo();
      const uc = new GetUserOrderHistoryUseCase(repo);
      await expect(uc.execute({ userId: '' })).rejects.toThrow('User ID is required');
    });

    it('throws when limit is out of range', async () => {
      const repo = makeRepo();
      const uc = new GetUserOrderHistoryUseCase(repo);
      await expect(uc.execute({ userId: 'u-1', limit: 200 })).rejects.toThrow();
    });

    it('throws when offset is negative', async () => {
      const repo = makeRepo();
      const uc = new GetUserOrderHistoryUseCase(repo);
      await expect(uc.execute({ userId: 'u-1', offset: -1 })).rejects.toThrow();
    });

    it('calculates hasMore correctly', async () => {
      const repo = makeRepo({
        getUserOrders: jest.fn().mockResolvedValue({
          orders: [{ id: 'ord-1' }, { id: 'ord-2' }],
          total: 10,
        }),
      });
      const uc = new GetUserOrderHistoryUseCase(repo);
      const result = await uc.execute({ userId: 'u-1', limit: 2, offset: 0 });
      expect(result.hasMore).toBe(true);
    });
  });

  describe('getRecentOrders', () => {
    it('returns recent orders for a userId', async () => {
      const repo = makeRepo();
      const uc = new GetUserOrderHistoryUseCase(repo);
      const orders = await uc.getRecentOrders('user-1', 3);
      expect(orders).toBeDefined();
      expect(repo.getUserOrders).toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'created_at', sortOrder: 'desc', limit: 3 }));
    });

    it('throws when userId is missing', async () => {
      const repo = makeRepo();
      const uc = new GetUserOrderHistoryUseCase(repo);
      await expect(uc.getRecentOrders('')).rejects.toThrow('User ID is required');
    });
  });

  describe('getOrdersByStatus', () => {
    it('returns orders filtered by status', async () => {
      const repo = makeRepo();
      const uc = new GetUserOrderHistoryUseCase(repo);
      await uc.getOrdersByStatus('user-1', 'pending');
      expect(repo.getUserOrders).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
    });

    it('throws when status is missing', async () => {
      const repo = makeRepo();
      const uc = new GetUserOrderHistoryUseCase(repo);
      await expect(uc.getOrdersByStatus('user-1', '')).rejects.toThrow('Order status is required');
    });
  });
});
