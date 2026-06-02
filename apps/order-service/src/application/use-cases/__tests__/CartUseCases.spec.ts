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

import { AddToCartUseCase } from '../AddToCartUseCase';
import { UpdateCartItemUseCase } from '../UpdateCartItemUseCase';
import { RemoveFromCartUseCase } from '../RemoveFromCartUseCase';
import { ClearUserCartUseCase } from '../ClearUserCartUseCase';
import type {
  IShoppingCartRepository,
  ShoppingCartItemData,
} from '../../../domain/repositories/IShoppingCartRepository';
import { NotFoundError } from '@hbs/shared-kernel';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeCartItem(overrides: Partial<ShoppingCartItemData> = {}): ShoppingCartItemData {
  return {
    id: 'item-1',
    cartId: 'cart-1',
    productId: 'prod-1',
    quantity: 2,
    price: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-1',
    email: 'owner@test.com',
    permissions: [],
    groups: ['customer'],
    ...overrides,
  };
}

function makeCartRepo(
  overrides: Partial<jest.Mocked<IShoppingCartRepository>> = {},
): jest.Mocked<IShoppingCartRepository> {
  return {
    addItem: jest.fn().mockResolvedValue(makeCartItem()),
    updateItem: jest.fn().mockResolvedValue(makeCartItem({ quantity: 5 })),
    removeItem: jest.fn().mockResolvedValue(true),
    clearCart: jest.fn().mockResolvedValue(true),
    ...overrides,
  } as jest.Mocked<IShoppingCartRepository>;
}

// ---------------------------------------------------------------------------
// AddToCartUseCase
// ---------------------------------------------------------------------------

describe('AddToCartUseCase', () => {
  it('uses userId from JWT, never from external input', async () => {
    const repo = makeCartRepo();
    const uc = new AddToCartUseCase(repo);
    const user = makeUser({ userId: 'jwt-user-id' });

    await uc.execute('prod-1', 2, user);

    // The repo must be called with the JWT userId, not any other value.
    expect(repo.addItem).toHaveBeenCalledWith('jwt-user-id', 'prod-1', 2);
  });

  it('returns the cart item on success', async () => {
    const uc = new AddToCartUseCase(makeCartRepo());
    const result = await uc.execute('prod-1', 2, makeUser());
    expect(result.id).toBe('item-1');
    expect(result.productId).toBe('prod-1');
  });

  it('propagates errors from the repository', async () => {
    const repo = makeCartRepo({
      addItem: jest.fn().mockRejectedValue(new Error('DB error')),
    });
    const uc = new AddToCartUseCase(repo);

    await expect(uc.execute('prod-1', 1, makeUser())).rejects.toThrow('DB error');
  });
});

// ---------------------------------------------------------------------------
// UpdateCartItemUseCase
// ---------------------------------------------------------------------------

describe('UpdateCartItemUseCase', () => {
  it('passes the JWT userId to the repository ownership check', async () => {
    const repo = makeCartRepo();
    const uc = new UpdateCartItemUseCase(repo);
    const user = makeUser({ userId: 'jwt-user-id' });

    await uc.execute('item-1', 5, user);

    expect(repo.updateItem).toHaveBeenCalledWith('item-1', 'jwt-user-id', 5);
  });

  it('returns the updated item on success', async () => {
    const uc = new UpdateCartItemUseCase(makeCartRepo());
    const result = await uc.execute('item-1', 5, makeUser());
    expect(result.quantity).toBe(5);
  });

  it('throws NotFoundError when the item does not exist or belongs to another user', async () => {
    const repo = makeCartRepo({
      updateItem: jest
        .fn()
        .mockRejectedValue(new NotFoundError('ShoppingCartItem', 'item-x')),
    });
    const uc = new UpdateCartItemUseCase(repo);

    await expect(uc.execute('item-x', 3, makeUser())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError for a cross-user access attempt (different userId in JWT)', async () => {
    // The repo rejects because the item belongs to 'user-2' but we supply 'user-1'.
    // The use case must propagate the error without modification.
    const repo = makeCartRepo({
      updateItem: jest
        .fn()
        .mockRejectedValue(new NotFoundError('ShoppingCartItem', 'item-1')),
    });
    const uc = new UpdateCartItemUseCase(repo);
    const attacker = makeUser({ userId: 'user-1' });

    await expect(uc.execute('item-1', 1, attacker)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// RemoveFromCartUseCase
// ---------------------------------------------------------------------------

describe('RemoveFromCartUseCase', () => {
  it('passes the JWT userId to the repository ownership check', async () => {
    const repo = makeCartRepo();
    const uc = new RemoveFromCartUseCase(repo);
    const user = makeUser({ userId: 'jwt-user-id' });

    await uc.execute('item-1', user);

    expect(repo.removeItem).toHaveBeenCalledWith('item-1', 'jwt-user-id');
  });

  it('returns true on success', async () => {
    const uc = new RemoveFromCartUseCase(makeCartRepo());
    const result = await uc.execute('item-1', makeUser());
    expect(result).toBe(true);
  });

  it('throws NotFoundError when the item does not exist or belongs to another user', async () => {
    const repo = makeCartRepo({
      removeItem: jest
        .fn()
        .mockRejectedValue(new NotFoundError('ShoppingCartItem', 'item-x')),
    });
    const uc = new RemoveFromCartUseCase(repo);

    await expect(uc.execute('item-x', makeUser())).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// ClearUserCartUseCase
// ---------------------------------------------------------------------------

describe('ClearUserCartUseCase', () => {
  it('uses userId from JWT to clear only the authenticated user cart', async () => {
    const repo = makeCartRepo();
    const uc = new ClearUserCartUseCase(repo);
    const user = makeUser({ userId: 'jwt-user-id' });

    await uc.execute(user);

    expect(repo.clearCart).toHaveBeenCalledWith('jwt-user-id');
  });

  it('returns true on success', async () => {
    const uc = new ClearUserCartUseCase(makeCartRepo());
    const result = await uc.execute(makeUser());
    expect(result).toBe(true);
  });

  it('propagates repository errors', async () => {
    const repo = makeCartRepo({
      clearCart: jest.fn().mockRejectedValue(new Error('DB failure')),
    });
    const uc = new ClearUserCartUseCase(repo);

    await expect(uc.execute(makeUser())).rejects.toThrow('DB failure');
  });
});
