import { PrismaClient } from '@prisma/client';
import type { TokenPayload } from '@hbs/auth';

import { IOrderRepository } from '../domain/repositories/IOrderRepository';
import { IPaymentMethodRepository } from '../domain/repositories/IPaymentMethodRepository';
import { IShoppingCartRepository } from '../domain/repositories/IShoppingCartRepository';
import { ITransactionRepository } from '../domain/repositories/ITransactionRepository';
import { ICouponRepository } from '../domain/repositories/ICouponRepository';
import { IStoreSettingsRepository } from '../domain/repositories/IStoreSettingsRepository';
import { IProductValidationPort } from '../domain/ports/IProductValidationPort';
import { IEventPublisher } from '../domain/ports/IEventPublisher';

import { CreateOrderUseCase } from '../application/use-cases/CreateOrderUseCase';
import { GetOrdersUseCase } from '../application/use-cases/GetOrdersUseCase';
import { GetOrderByIdUseCase } from '../application/use-cases/GetOrderByIdUseCase';
import { UpdateOrderUseCase } from '../application/use-cases/UpdateOrderUseCase';
import { GetOrderStatsUseCase } from '../application/use-cases/GetOrderStatsUseCase';
import { CreatePaymentMethodUseCase } from '../application/use-cases/CreatePaymentMethodUseCase';
import { UpdatePaymentMethodUseCase } from '../application/use-cases/UpdatePaymentMethodUseCase';
import { DeletePaymentMethodUseCase } from '../application/use-cases/DeletePaymentMethodUseCase';
import {
  GetUserPaymentMethodsUseCase,
  GetPaymentMethodByIdUseCase,
} from '../application/use-cases/GetUserPaymentMethodsUseCase';
import {
  GetUserTransactionsUseCase,
  GetTransactionByIdUseCase,
} from '../application/use-cases/GetUserTransactionsUseCase';
import { AddToCartUseCase } from '../application/use-cases/AddToCartUseCase';
import { UpdateCartItemUseCase } from '../application/use-cases/UpdateCartItemUseCase';
import { RemoveFromCartUseCase } from '../application/use-cases/RemoveFromCartUseCase';
import { ClearUserCartUseCase } from '../application/use-cases/ClearUserCartUseCase';
import {
  GetUserCartUseCase,
  GetCartItemByIdUseCase,
} from '../application/use-cases/GetUserCartUseCase';
import {
  GetCouponsUseCase,
  GetCouponByIdUseCase,
  GetCouponByCodeUseCase,
  GetUserCouponUsageUseCase,
} from '../application/use-cases/GetCouponUseCase';
import {
  GetStoreSettingsUseCase,
  GetStoreSettingByKeyUseCase,
} from '../application/use-cases/GetStoreSettingsUseCase';

// ── Canonical guard — single source of truth for management group list ────────
// Use assertOrderManagementAccess (throws GraphQLError UNAUTHENTICATED/FORBIDDEN) for
// direct resolver guards (orders, orderStats, ordersByStatus). Use cases call the same
// exported helpers from this module so both paths share one definition.
import { assertOrderManagementAccess } from '../application/use-cases/guards/orderAuthGuards';

import { NotFoundError, ForbiddenError } from '@hbs/shared-kernel';
import { GraphQLError } from 'graphql';
import { requirePermission, requireRole, Permission, UserRole } from '@hbs/auth';

// ── Shared error mapper ───────────────────────────────────────────────────────

function mapDomainError(error: unknown): never {
  if (error instanceof NotFoundError) {
    throw new GraphQLError(error.message, {
      extensions: { code: 'NOT_FOUND', http: { status: 404 } },
    });
  }
  if (error instanceof ForbiddenError) {
    throw new GraphQLError(error.message, {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
  // GraphQLError (UNAUTHENTICATED / FORBIDDEN from use-case guards) passes through as-is.
  if (error instanceof GraphQLError) {
    throw error;
  }
  throw error;
}

// ── Transformers ─────────────────────────────────────────────────────────────

function transformOrder(order: any) {
  return {
    ...order,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
    updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : order.updatedAt,
    deliveredAt:
      order.deliveredAt instanceof Date ? order.deliveredAt.toISOString() : order.deliveredAt,
    items: (order.items || []).map((item: any) => ({
      ...item,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    })),
  };
}

function toIso(v: any) {
  return v instanceof Date ? v.toISOString() : v;
}

function transformPaymentMethod(pm: any) {
  return {
    ...pm,
    amount: Number(pm.amount),
    createdAt: toIso(pm.createdAt),
    updatedAt: toIso(pm.updatedAt),
  };
}

function transformTransaction(t: any) {
  return {
    ...t,
    amount: Number(t.amount),
    createdAt: toIso(t.createdAt),
    updatedAt: toIso(t.updatedAt),
  };
}

function transformCoupon(c: any) {
  return {
    ...c,
    discountValue: Number(c.discountValue),
    minimumAmount: c.minimumAmount != null ? Number(c.minimumAmount) : null,
    maximumDiscount: c.maximumDiscount != null ? Number(c.maximumDiscount) : null,
    validFrom: toIso(c.validFrom),
    validUntil: toIso(c.validUntil),
    createdAt: toIso(c.createdAt),
    updatedAt: toIso(c.updatedAt),
  };
}

function transformCouponUsage(u: any) {
  return { ...u, discountAmount: Number(u.discountAmount), usedAt: toIso(u.usedAt) };
}

function transformShippingRate(r: any) {
  return {
    ...r,
    price: Number(r.price),
    minWeight: r.minWeight != null ? Number(r.minWeight) : null,
    maxWeight: r.maxWeight != null ? Number(r.maxWeight) : null,
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
  };
}

function transformShippingZone(z: any) {
  return { ...z, createdAt: toIso(z.createdAt), updatedAt: toIso(z.updatedAt) };
}

function transformCarrier(c: any) {
  return { ...c, createdAt: toIso(c.createdAt), updatedAt: toIso(c.updatedAt) };
}

function transformDeliverySlot(s: any) {
  return { ...s, createdAt: toIso(s.createdAt), updatedAt: toIso(s.updatedAt) };
}

function transformCartItem(item: any) {
  return {
    ...item,
    price: Number(item.price),
    cart: { __typename: 'ShoppingCart', id: item.cartId },
    product: { __typename: 'Product', id: item.productId },
  };
}

function transformCartData(c: any) {
  return {
    ...c,
    items: (c.items || []).map(transformCartItem),
  };
}

export function createResolvers(
  orderRepository: IOrderRepository,
  productValidation: IProductValidationPort,
  eventPublisher: IEventPublisher,
  prisma: PrismaClient,
  paymentMethodRepository: IPaymentMethodRepository,
  cartRepository: IShoppingCartRepository,
  transactionRepository: ITransactionRepository,
  couponRepository: ICouponRepository,
  storeSettingsRepository: IStoreSettingsRepository,
) {
  // ── Order use cases ────────────────────────────────────────────────────────
  const createOrderUseCase = new CreateOrderUseCase(
    orderRepository,
    productValidation,
    eventPublisher,
  );
  const getOrdersUseCase = new GetOrdersUseCase(orderRepository);
  const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);
  const updateOrderUseCase = new UpdateOrderUseCase(orderRepository);
  const getOrderStatsUseCase = new GetOrderStatsUseCase(orderRepository);

  // ── PaymentMethod use cases ────────────────────────────────────────────────
  const createPaymentMethodUseCase = new CreatePaymentMethodUseCase(paymentMethodRepository);
  const updatePaymentMethodUseCase = new UpdatePaymentMethodUseCase(paymentMethodRepository);
  const deletePaymentMethodUseCase = new DeletePaymentMethodUseCase(paymentMethodRepository);
  const getUserPaymentMethodsUseCase = new GetUserPaymentMethodsUseCase(paymentMethodRepository);
  const getPaymentMethodByIdUseCase = new GetPaymentMethodByIdUseCase(paymentMethodRepository);

  // ── Transaction use cases ──────────────────────────────────────────────────
  const getUserTransactionsUseCase = new GetUserTransactionsUseCase(transactionRepository);
  const getTransactionByIdUseCase = new GetTransactionByIdUseCase(transactionRepository);

  // ── Cart use cases ─────────────────────────────────────────────────────────
  const addToCartUseCase = new AddToCartUseCase(cartRepository);
  const updateCartItemUseCase = new UpdateCartItemUseCase(cartRepository);
  const removeFromCartUseCase = new RemoveFromCartUseCase(cartRepository);
  const clearUserCartUseCase = new ClearUserCartUseCase(cartRepository);
  const getUserCartUseCase = new GetUserCartUseCase(cartRepository);
  const getCartItemByIdUseCase = new GetCartItemByIdUseCase(cartRepository);

  // ── Coupon use cases ───────────────────────────────────────────────────────
  const getCouponsUseCase = new GetCouponsUseCase(couponRepository);
  const getCouponByIdUseCase = new GetCouponByIdUseCase(couponRepository);
  const getCouponByCodeUseCase = new GetCouponByCodeUseCase(couponRepository);
  const getUserCouponUsageUseCase = new GetUserCouponUsageUseCase(couponRepository);

  // ── StoreSettings use cases ────────────────────────────────────────────────
  const getStoreSettingsUseCase = new GetStoreSettingsUseCase(storeSettingsRepository);
  const getStoreSettingByKeyUseCase = new GetStoreSettingByKeyUseCase(storeSettingsRepository);

  return {
    Query: {
      // ── Orders ──────────────────────────────────────────────────────────

      orders: async (_: any, { filter, pagination }: any, context: any) => {
        assertOrderManagementAccess(context.currentUser);
        const result = await getOrdersUseCase.execute({
          filters: filter,
          pagination,
          currentUser: context.currentUser ?? null,
        });
        return {
          orders: result.orders.map(transformOrder),
          total: result.total,
          hasMore: result.hasMore,
        };
      },

      order: async (_: any, { id }: { id: string }, context: any) => {
        // queries are not guarded by the authPlugin (only mutations are).
        // Authentication is required to access any order data.
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        try {
          const order = await getOrderByIdUseCase.execute(id, context.currentUser);
          return order ? transformOrder(order) : null;
        } catch (error) {
          return mapDomainError(error);
        }
      },

      orderStats: async (_: any, __: any, context: any) => {
        // Aggregate stats contain PII-adjacent revenue data — restrict to management roles.
        assertOrderManagementAccess(context.currentUser);
        return getOrderStatsUseCase.execute();
      },

      ordersByStatus: async (_: any, { status }: { status: string }, context: any) => {
        assertOrderManagementAccess(context.currentUser);
        const orders = await orderRepository.findByStatus(status);
        return orders.map(transformOrder);
      },

      // ── Payment methods ──────────────────────────────────────────────────
      // SECURITY: these queries were previously unguarded (direct prisma access).
      // Now routed through use cases that enforce owner-or-management policy.

      userPaymentMethods: async (_: any, { userId }: { userId: string }, context: any) => {
        try {
          const pms = await getUserPaymentMethodsUseCase.execute(userId, context.currentUser ?? null);
          return pms.map(transformPaymentMethod);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      paymentMethod: async (_: any, { id }: { id: string }, context: any) => {
        try {
          const pm = await getPaymentMethodByIdUseCase.execute(id, context.currentUser ?? null);
          return transformPaymentMethod(pm);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Transactions ─────────────────────────────────────────────────────
      // SECURITY: these queries were previously unguarded. Now enforce owner-or-management.

      userTransactions: async (_: any, { userId }: { userId: string }, context: any) => {
        try {
          const txs = await getUserTransactionsUseCase.execute(userId, context.currentUser ?? null);
          return txs.map(transformTransaction);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      transaction: async (_: any, { id }: { id: string }, context: any) => {
        try {
          const tx = await getTransactionByIdUseCase.execute(id, context.currentUser ?? null);
          return transformTransaction(tx);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Coupons ──────────────────────────────────────────────────────────
      // SECURITY: coupons/coupon require management; couponByCode requires auth only.
      // activeCoupons remains public (storefront needs it without login).

      coupons: async (_: any, __: any, context: any) => {
        try {
          const items = await getCouponsUseCase.execute(context.currentUser ?? null);
          return items.map(transformCoupon);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      coupon: async (_: any, { id }: { id: string }, context: any) => {
        try {
          const c = await getCouponByIdUseCase.execute(id, context.currentUser ?? null);
          return transformCoupon(c);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      couponByCode: async (_: any, { code }: { code: string }, context: any) => {
        try {
          const c = await getCouponByCodeUseCase.execute(code, context.currentUser ?? null);
          return c ? transformCoupon(c) : null;
        } catch (error) {
          return mapDomainError(error);
        }
      },

      activeCoupons: async (_: any, __: any, _context: any) => {
        // PUBLIC — storefront requires coupon discovery without authentication.
        const now = new Date();
        const items = await prisma.coupon.findMany({
          where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
          orderBy: { createdAt: 'desc' },
        });
        return items.map(transformCoupon);
      },

      userCouponUsage: async (_: any, { userId }: { userId: string }, context: any) => {
        try {
          const items = await getUserCouponUsageUseCase.execute(userId, context.currentUser ?? null);
          return items.map(transformCouponUsage);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Shipping & logistics ─────────────────────────────────────────────
      // PUBLIC — storefront needs these without login.

      carriers: async () => {
        const items = await prisma.carrier.findMany({ orderBy: { name: 'asc' } });
        return items.map(transformCarrier);
      },

      carrier: async (_: any, { id }: { id: string }) => {
        const c = await prisma.carrier.findUnique({ where: { id } });
        return c ? transformCarrier(c) : null;
      },

      shippingZones: async () => {
        const items = await prisma.shippingZone.findMany({ orderBy: { name: 'asc' } });
        return items.map(transformShippingZone);
      },

      shippingZone: async (_: any, { id }: { id: string }) => {
        const z = await prisma.shippingZone.findUnique({ where: { id } });
        return z ? transformShippingZone(z) : null;
      },

      shippingRates: async (_: any, { zoneId }: { zoneId: string }) => {
        const items = await prisma.shippingRate.findMany({
          where: { zoneId },
          orderBy: { price: 'asc' },
        });
        return items.map(transformShippingRate);
      },

      deliverySlots: async () => {
        const items = await prisma.deliverySlot.findMany({
          where: { isActive: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        });
        return items.map(transformDeliverySlot);
      },

      // ── Shopping cart queries ────────────────────────────────────────────
      // SECURITY: previously direct prisma access without auth guard.
      // Now routed through use cases enforcing owner-or-management policy.

      userCart: async (_: any, { userId }: any, context: any) => {
        try {
          const carts = await getUserCartUseCase.execute(userId, context.currentUser ?? null);
          return carts.map(transformCartData);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      cartItem: async (_: any, { id }: any, context: any) => {
        try {
          const item = await getCartItemByIdUseCase.execute(id, context.currentUser ?? null);
          return transformCartItem(item);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Store settings ───────────────────────────────────────────────────
      // SECURITY: previously unguarded direct prisma access.
      // Now restricted to management/admin — settings contain sensitive config.

      storeSettings: async (_: any, __: any, context: any) => {
        try {
          const items = await getStoreSettingsUseCase.execute(context.currentUser ?? null);
          return items;
        } catch (error) {
          return mapDomainError(error);
        }
      },

      storeSetting: async (_: any, { key }: any, context: any) => {
        try {
          const setting = await getStoreSettingByKeyUseCase.execute(key, context.currentUser ?? null);
          return setting;
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Tax rates ────────────────────────────────────────────────────────
      // PUBLIC — storefront needs tax rates without login.

      taxRates: async () => {
        try {
          const rates = await prisma.taxRate.findMany({ where: { isActive: true } });
          return rates.map((r) => ({ ...r, rate: Number(r.rate) }));
        } catch {
          return [];
        }
      },

      taxRate: async (_: any, { id }: any) => {
        try {
          const r = await prisma.taxRate.findUnique({ where: { id } });
          return r ? { ...r, rate: Number(r.rate) } : null;
        } catch {
          return null;
        }
      },
    },

    Mutation: {
      // ── Orders ──────────────────────────────────────────────────────────

      createOrder: async (_: any, { input }: { input: any }, context: any) => {
        // customerEmail and userId are always derived from the authenticated JWT —
        // never accepted from client input (prevents BOLA / CWE-639).
        if (!context.currentUser) {
          throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
        }
        const order = await createOrderUseCase.execute({
          userId: context.currentUser.userId,
          customerEmail: context.currentUser.email,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          items: input.items,
          shippingAddress: input.shippingAddress,
        });
        return transformOrder(order);
      },

      updateOrder: async (_: any, { id, input }: { id: string; input: any }, context: any) => {
        requirePermission(context.currentUser, Permission.UPDATE_ORDER);
        try {
          const order = await updateOrderUseCase.execute(
            id,
            {
              status: input.status,
              customerEmail: input.customerEmail,
              customerName: input.customerName,
              customerPhone: input.customerPhone,
            },
            context.currentUser ?? null,
          );
          return transformOrder(order);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      updateOrderStatus: async (
        _: any,
        { id, status }: { id: string; status: string },
        context: any,
      ) => {
        requirePermission(context.currentUser, Permission.UPDATE_ORDER);
        try {
          const order = await updateOrderUseCase.execute(
            id,
            { status: status as any },
            context.currentUser ?? null,
          );
          return transformOrder(order);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      deleteOrder: async (_: any, { id }: { id: string }, context: any) => {
        requireRole(context.currentUser, UserRole.ADMIN);
        try {
          return await orderRepository.delete(id, context.currentUser ?? null);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      bulkUpdateOrderStatus: async (
        _: any,
        { orders, status }: { orders: string[]; status: string },
        context: any,
      ) => {
        requirePermission(context.currentUser, Permission.UPDATE_ORDER);
        try {
          const updated = await Promise.all(
            orders.map((id) =>
              updateOrderUseCase.execute(id, { status: status as any }, context.currentUser ?? null),
            ),
          );
          return updated.map(transformOrder);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Payment methods ──────────────────────────────────────────────────
      // CRITICAL 1 FIX: operations now go through use cases that enforce
      // assertWriteAccess on the parent Order before mutating.
      // The authPlugin already guarantees currentUser is non-null for all mutations.

      createPaymentMethod: async (_: any, { input }: any, context: any) => {
        try {
          const pm = await createPaymentMethodUseCase.execute(input, context.currentUser!);
          return transformPaymentMethod(pm);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      updatePaymentMethod: async (_: any, { id, input }: any, context: any) => {
        try {
          const pm = await updatePaymentMethodUseCase.execute(id, input, context.currentUser!);
          return transformPaymentMethod(pm);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      deletePaymentMethod: async (_: any, { id }: { id: string }, context: any) => {
        try {
          return await deletePaymentMethodUseCase.execute(id, context.currentUser!);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Coupons ──────────────────────────────────────────────────────────
      createCoupon: async (_: any, { input }: any, context: any) => {
        requireRole(context.currentUser, UserRole.ADMIN);
        const c = await prisma.coupon.create({
          data: {
            code: input.code,
            name: input.name,
            description: input.description,
            discountType: input.discountType,
            discountValue: input.discountValue,
            minimumAmount: input.minimumAmount,
            maximumDiscount: input.maximumDiscount,
            usageLimit: input.usageLimit,
            validFrom: new Date(input.validFrom),
            validUntil: new Date(input.validUntil),
            isActive: input.isActive ?? true,
            isFirstTimeOnly: input.isFirstTimeOnly ?? false,
            applicableCategories: input.applicableCategories || [],
            applicableProducts: input.applicableProducts || [],
          },
        });
        return transformCoupon(c);
      },

      updateCoupon: async (_: any, { id, input }: any, context: any) => {
        requireRole(context.currentUser, UserRole.ADMIN);
        const updateData: any = {};
        if (input.name) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.discountValue != null) updateData.discountValue = input.discountValue;
        if (input.minimumAmount !== undefined) updateData.minimumAmount = input.minimumAmount;
        if (input.maximumDiscount !== undefined) updateData.maximumDiscount = input.maximumDiscount;
        if (input.usageLimit !== undefined) updateData.usageLimit = input.usageLimit;
        if (input.validFrom) updateData.validFrom = new Date(input.validFrom);
        if (input.validUntil) updateData.validUntil = new Date(input.validUntil);
        if (input.isActive !== undefined) updateData.isActive = input.isActive;
        if (input.isFirstTimeOnly !== undefined) updateData.isFirstTimeOnly = input.isFirstTimeOnly;
        if (input.applicableCategories)
          updateData.applicableCategories = input.applicableCategories;
        if (input.applicableProducts) updateData.applicableProducts = input.applicableProducts;
        const c = await prisma.coupon.update({ where: { id }, data: updateData });
        return transformCoupon(c);
      },

      deleteCoupon: async (_: any, { id }: { id: string }, context: any) => {
        requireRole(context.currentUser, UserRole.ADMIN);
        await prisma.coupon.delete({ where: { id } });
        return true;
      },

      // ── Carriers ─────────────────────────────────────────────────────────
      createCarrier: async (_: any, { input }: any, context: any) => {
        requireRole(context.currentUser, UserRole.ADMIN);
        const c = await prisma.carrier.create({
          data: {
            name: input.name,
            code: input.code,
            trackingUrlTemplate: input.trackingUrlTemplate,
            isActive: input.isActive ?? true,
          },
        });
        return transformCarrier(c);
      },

      updateCarrier: async (
        _: any,
        { id, name, code, trackingUrlTemplate, isActive }: any,
        context: any,
      ) => {
        requireRole(context.currentUser, UserRole.ADMIN);
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (code !== undefined) updateData.code = code;
        if (trackingUrlTemplate !== undefined) updateData.trackingUrlTemplate = trackingUrlTemplate;
        if (isActive !== undefined) updateData.isActive = isActive;
        const c = await prisma.carrier.update({ where: { id }, data: updateData });
        return transformCarrier(c);
      },

      deleteCarrier: async (_: any, { id }: { id: string }, context: any) => {
        requireRole(context.currentUser, UserRole.ADMIN);
        await prisma.carrier.delete({ where: { id } });
        return true;
      },

      // ── Shipping zones & rates ────────────────────────────────────────────
      createShippingZone: async (_: any, { input }: any, context: any) => {
        requireRole(context.currentUser, UserRole.ADMIN);
        const z = await prisma.shippingZone.create({
          data: {
            name: input.name,
            countries: input.countries,
            states: input.states || [],
            cities: input.cities || [],
            postalCodes: input.postalCodes || [],
            isActive: input.isActive ?? true,
          },
        });
        return transformShippingZone(z);
      },

      createShippingRate: async (_: any, { input }: any, context: any) => {
        requireRole(context.currentUser, UserRole.ADMIN);
        const r = await prisma.shippingRate.create({
          data: {
            zoneId: input.zoneId,
            name: input.name,
            minWeight: input.minWeight,
            maxWeight: input.maxWeight,
            price: input.price,
            isActive: input.isActive ?? true,
          },
        });
        return transformShippingRate(r);
      },

      // ── Shopping cart mutations ──────────────────────────────────────────
      // CRITICAL 2 FIX: identity is always derived from context.currentUser (JWT),
      // never from client-supplied userId input.
      // The authPlugin guarantees currentUser is non-null for all mutations.

      addToCart: async (_: any, { productId, quantity }: any, context: any) => {
        try {
          const item = await addToCartUseCase.execute(productId, quantity, context.currentUser!);
          return transformCartItem(item);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      updateCartItem: async (_: any, { id, quantity }: any, context: any) => {
        try {
          const item = await updateCartItemUseCase.execute(id, quantity, context.currentUser!);
          return transformCartItem(item);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      removeFromCart: async (_: any, { id }: any, context: any) => {
        try {
          await removeFromCartUseCase.execute(id, context.currentUser!);
          return { success: true, message: 'Item removed from cart' };
        } catch (error) {
          if (error instanceof NotFoundError) {
            throw new GraphQLError(error.message, {
              extensions: { code: 'NOT_FOUND', http: { status: 404 } },
            });
          }
          throw error;
        }
      },

      clearUserCart: async (_: any, __: any, context: any) => {
        try {
          await clearUserCartUseCase.execute(context.currentUser!);
          return { success: true, message: 'Cart cleared' };
        } catch (error) {
          return mapDomainError(error);
        }
      },
    },

    Order: {
      // __resolveReference is called by the federation gateway.
      // The gateway forwards the Authorization header, so context.currentUser is set
      // for authenticated requests — record-rule filters apply correctly here.
      __resolveReference: async ({ id }: { id: string }, context: any) => {
        const order = await orderRepository.findById(id, context?.currentUser ?? null);
        return order ? transformOrder(order) : null;
      },
      user: (parent: any) => ({ __typename: 'User', id: parent.userId }),
      items: async (parent: any) => {
        if (parent.items?.length) return parent.items;
        const items = await orderRepository.getOrderItems(parent.id);
        return items.map((item: any) => ({
          ...item,
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
        }));
      },
    },

    OrderItem: {
      __resolveReference: async ({ id }: { id: string }) => {
        const items = await orderRepository.getOrderItems(id);
        return items[0] || null;
      },
      product: (parent: any) => ({ __typename: 'Product', id: parent.productId }),
      order: async (parent: any, _args: any, context: any) => {
        const order = await orderRepository.findById(parent.orderId, context?.currentUser ?? null);
        return order ? transformOrder(order) : null;
      },
    },
  };
}
