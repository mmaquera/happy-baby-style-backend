import type { TokenPayload } from '@hbs/auth';

import { IOrderRepository } from '../domain/repositories/IOrderRepository';
import { IOrderAuditRepository } from '../domain/repositories/IOrderAuditRepository';
import { ISequenceRepository } from '../domain/repositories/ISequenceRepository';
import { IPaymentMethodRepository } from '../domain/repositories/IPaymentMethodRepository';
import { IShoppingCartRepository } from '../domain/repositories/IShoppingCartRepository';
import { ITransactionRepository } from '../domain/repositories/ITransactionRepository';
import { ICouponRepository } from '../domain/repositories/ICouponRepository';
import { IStoreSettingsRepository } from '../domain/repositories/IStoreSettingsRepository';
import { ICarrierRepository } from '../domain/repositories/ICarrierRepository';
import { IShippingZoneRepository } from '../domain/repositories/IShippingZoneRepository';
import { IShippingRateRepository } from '../domain/repositories/IShippingRateRepository';
import { IDeliverySlotRepository } from '../domain/repositories/IDeliverySlotRepository';
import { ITaxRateRepository } from '../domain/repositories/ITaxRateRepository';
import { IProductValidationPort } from '../domain/ports/IProductValidationPort';
import { IEventPublisher } from '../domain/ports/IEventPublisher';

import { CreateOrderUseCase } from '../application/use-cases/CreateOrderUseCase';
import { GetOrdersUseCase } from '../application/use-cases/GetOrdersUseCase';
import { GetOrderByIdUseCase } from '../application/use-cases/GetOrderByIdUseCase';
import { UpdateOrderUseCase } from '../application/use-cases/UpdateOrderUseCase';
import { DeleteOrderUseCase } from '../application/use-cases/DeleteOrderUseCase';
import { BulkUpdateOrderStatusUseCase } from '../application/use-cases/BulkUpdateOrderStatusUseCase';
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
  CreateCouponUseCase,
  UpdateCouponUseCase,
  DeleteCouponUseCase,
  GetActiveCouponsUseCase,
} from '../application/use-cases/CouponAdminUseCases';
import {
  GetStoreSettingsUseCase,
  GetStoreSettingByKeyUseCase,
} from '../application/use-cases/GetStoreSettingsUseCase';
import {
  GetCarriersUseCase,
  GetCarrierByIdUseCase,
  CreateCarrierUseCase,
  UpdateCarrierUseCase,
  DeleteCarrierUseCase,
} from '../application/use-cases/CarrierAdminUseCases';
import {
  GetShippingZonesUseCase,
  GetShippingZoneByIdUseCase,
  CreateShippingZoneUseCase,
  UpdateShippingZoneUseCase,
  DeleteShippingZoneUseCase,
} from '../application/use-cases/ShippingZoneAdminUseCases';
import {
  GetShippingRatesByZoneUseCase,
  CreateShippingRateUseCase,
  UpdateShippingRateUseCase,
  DeleteShippingRateUseCase,
} from '../application/use-cases/ShippingRateAdminUseCases';
import {
  GetDeliverySlotsUseCase,
  CreateDeliverySlotUseCase,
  UpdateDeliverySlotUseCase,
  DeleteDeliverySlotUseCase,
} from '../application/use-cases/DeliverySlotAdminUseCases';
import {
  GetTaxRatesUseCase,
  GetTaxRateByIdUseCase,
  CreateTaxRateUseCase,
  UpdateTaxRateUseCase,
  DeleteTaxRateUseCase,
} from '../application/use-cases/TaxRateAdminUseCases';

// ── Canonical guard — single source of truth for management group list ────────
import { assertOrderManagementAccess } from '../application/use-cases/guards/orderAuthGuards';

import { assertModelAccess } from '@hbs/authz';
import { NotFoundError, ForbiddenError, ValidationError, DuplicateError } from '@hbs/shared-kernel';
import { GraphQLError } from 'graphql';

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
  if (error instanceof ValidationError) {
    throw new GraphQLError(error.message, {
      extensions: { code: 'BAD_USER_INPUT', http: { status: 400 } },
    });
  }
  if (error instanceof DuplicateError) {
    throw new GraphQLError(error.message, {
      extensions: { code: 'CONFLICT', http: { status: 409 } },
    });
  }
  // GraphQLError (UNAUTHENTICATED / FORBIDDEN from use-case guards) passes through as-is.
  if (error instanceof GraphQLError) {
    throw error;
  }
  // Prisma P2025 on update/delete of nonexistent record → ambiguous 404.
  if ((error as any)?.code === 'P2025') {
    throw new GraphQLError('Record not found', {
      extensions: { code: 'NOT_FOUND', http: { status: 404 } },
    });
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
    // IGV accumulators — SDL declares Decimal! (non-null); default 0 for historic orders
    // where DB values are 0 (set by migration DEFAULT 0).
    taxableAmount: order.taxableAmount ?? 0,
    exemptAmount: order.exemptAmount ?? 0,
    nonTaxableAmount: order.nonTaxableAmount ?? 0,
    igvAmount: order.igvAmount ?? 0,
    items: (order.items || []).map((item: any) => ({
      ...item,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
      // Fiscal snapshot — SDL declares taxAffectation: TaxAffectation! (non-null)
      taxAffectation: item.taxAffectation ?? 'gravado',
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

function transformTaxRate(r: any) {
  return { ...r, rate: Number(r.rate), createdAt: toIso(r.createdAt), updatedAt: toIso(r.updatedAt) };
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
  paymentMethodRepository: IPaymentMethodRepository,
  cartRepository: IShoppingCartRepository,
  transactionRepository: ITransactionRepository,
  couponRepository: ICouponRepository,
  storeSettingsRepository: IStoreSettingsRepository,
  sequenceRepository: ISequenceRepository,
  auditRepository: IOrderAuditRepository,
  carrierRepository: ICarrierRepository,
  shippingZoneRepository: IShippingZoneRepository,
  shippingRateRepository: IShippingRateRepository,
  deliverySlotRepository: IDeliverySlotRepository,
  taxRateRepository: ITaxRateRepository,
) {
  // ── Order use cases ────────────────────────────────────────────────────────
  const createOrderUseCase = new CreateOrderUseCase(
    orderRepository,
    productValidation,
    eventPublisher,
    sequenceRepository,
    storeSettingsRepository,
  );
  const getOrdersUseCase = new GetOrdersUseCase(orderRepository);
  const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);
  const updateOrderUseCase = new UpdateOrderUseCase(orderRepository, auditRepository, eventPublisher);
  const deleteOrderUseCase = new DeleteOrderUseCase(orderRepository);
  const bulkUpdateOrderStatusUseCase = new BulkUpdateOrderStatusUseCase(updateOrderUseCase);
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
  const createCouponUseCase = new CreateCouponUseCase(couponRepository);
  const updateCouponUseCase = new UpdateCouponUseCase(couponRepository);
  const deleteCouponUseCase = new DeleteCouponUseCase(couponRepository);
  const getActiveCouponsUseCase = new GetActiveCouponsUseCase(couponRepository);

  // ── StoreSettings use cases ────────────────────────────────────────────────
  const getStoreSettingsUseCase = new GetStoreSettingsUseCase(storeSettingsRepository);
  const getStoreSettingByKeyUseCase = new GetStoreSettingByKeyUseCase(storeSettingsRepository);

  // ── Carrier use cases ──────────────────────────────────────────────────────
  const getCarriersUseCase = new GetCarriersUseCase(carrierRepository);
  const getCarrierByIdUseCase = new GetCarrierByIdUseCase(carrierRepository);
  const createCarrierUseCase = new CreateCarrierUseCase(carrierRepository);
  const updateCarrierUseCase = new UpdateCarrierUseCase(carrierRepository);
  const deleteCarrierUseCase = new DeleteCarrierUseCase(carrierRepository);

  // ── ShippingZone use cases ─────────────────────────────────────────────────
  const getShippingZonesUseCase = new GetShippingZonesUseCase(shippingZoneRepository);
  const getShippingZoneByIdUseCase = new GetShippingZoneByIdUseCase(shippingZoneRepository);
  const createShippingZoneUseCase = new CreateShippingZoneUseCase(shippingZoneRepository);
  const updateShippingZoneUseCase = new UpdateShippingZoneUseCase(shippingZoneRepository);
  const deleteShippingZoneUseCase = new DeleteShippingZoneUseCase(shippingZoneRepository);

  // ── ShippingRate use cases ─────────────────────────────────────────────────
  const getShippingRatesByZoneUseCase = new GetShippingRatesByZoneUseCase(shippingRateRepository);
  const createShippingRateUseCase = new CreateShippingRateUseCase(shippingRateRepository);
  const updateShippingRateUseCase = new UpdateShippingRateUseCase(shippingRateRepository);
  const deleteShippingRateUseCase = new DeleteShippingRateUseCase(shippingRateRepository);

  // ── DeliverySlot use cases ─────────────────────────────────────────────────
  const getDeliverySlotsUseCase = new GetDeliverySlotsUseCase(deliverySlotRepository);
  const createDeliverySlotUseCase = new CreateDeliverySlotUseCase(deliverySlotRepository);
  const updateDeliverySlotUseCase = new UpdateDeliverySlotUseCase(deliverySlotRepository);
  const deleteDeliverySlotUseCase = new DeleteDeliverySlotUseCase(deliverySlotRepository);

  // ── TaxRate use cases ──────────────────────────────────────────────────────
  const getTaxRatesUseCase = new GetTaxRatesUseCase(taxRateRepository);
  const getTaxRateByIdUseCase = new GetTaxRateByIdUseCase(taxRateRepository);
  const createTaxRateUseCase = new CreateTaxRateUseCase(taxRateRepository);
  const updateTaxRateUseCase = new UpdateTaxRateUseCase(taxRateRepository);
  const deleteTaxRateUseCase = new DeleteTaxRateUseCase(taxRateRepository);

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
        const orders = await orderRepository.findByStatus(status, context.currentUser ?? null);
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

      activeCoupons: async () => {
        // PUBLIC — storefront requires coupon discovery without authentication.
        const items = await getActiveCouponsUseCase.execute();
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
        const items = await getCarriersUseCase.execute();
        return items.map(transformCarrier);
      },

      carrier: async (_: any, { id }: { id: string }) => {
        const c = await getCarrierByIdUseCase.execute(id);
        return c ? transformCarrier(c) : null;
      },

      shippingZones: async () => {
        const items = await getShippingZonesUseCase.execute();
        return items.map(transformShippingZone);
      },

      shippingZone: async (_: any, { id }: { id: string }) => {
        const z = await getShippingZoneByIdUseCase.execute(id);
        return z ? transformShippingZone(z) : null;
      },

      shippingRates: async (_: any, { zoneId }: { zoneId: string }) => {
        const items = await getShippingRatesByZoneUseCase.execute(zoneId);
        return items.map(transformShippingRate);
      },

      deliverySlots: async () => {
        const items = await getDeliverySlotsUseCase.execute();
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
          const rates = await getTaxRatesUseCase.execute();
          return rates.map(transformTaxRate);
        } catch {
          return [];
        }
      },

      taxRate: async (_: any, { id }: any) => {
        try {
          const r = await getTaxRateByIdUseCase.execute(id);
          return r ? transformTaxRate(r) : null;
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
          // billingData is optional — when absent, all billing fields stored as null.
          billingData: input.billingData ?? undefined,
        });
        return transformOrder(order);
      },

      updateOrder: async (_: any, { id, input }: { id: string; input: any }, context: any) => {
        assertModelAccess(context.currentUser, 'Order', 'write');
        try {
          const order = await updateOrderUseCase.execute(
            id,
            {
              // paymentStatus is NOT included — it is write-only via order.paid event (rule C-1).
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
        assertModelAccess(context.currentUser, 'Order', 'write');
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
        assertModelAccess(context.currentUser, 'Order', 'unlink');
        try {
          return await deleteOrderUseCase.execute(id, context.currentUser ?? null);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      bulkUpdateOrderStatus: async (
        _: any,
        { orders, status }: { orders: string[]; status: string },
        context: any,
      ) => {
        assertModelAccess(context.currentUser, 'Order', 'write');
        try {
          // Delegates to BulkUpdateOrderStatusUseCase which:
          //   1. Validates array size <= 100 (ValidationError -> BAD_USER_INPUT)
          //   2. Uses Promise.allSettled: a denied/missing order does NOT abort the batch
          //   3. Returns only successfully updated orders; logs failed IDs server-side
          //      without exposing which IDs failed (preserves ambiguity-404)
          const updated = await bulkUpdateOrderStatusUseCase.execute(
            orders,
            status,
            context.currentUser ?? null,
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
        assertModelAccess(context.currentUser, 'Coupon', 'create');
        try {
          const c = await createCouponUseCase.execute(
            {
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
            context.currentUser!,
          );
          return transformCoupon(c);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      updateCoupon: async (_: any, { id, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'Coupon', 'write');
        try {
          // Build a typed UpdateCouponData DTO — no `as any` cast needed.
          // Only include fields that are explicitly present in the input so that
          // the repository's partial-update semantics (undefined = no change) work correctly.
          const updateData: import('../domain/repositories/ICouponRepository').UpdateCouponData = {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.discountValue != null && { discountValue: input.discountValue }),
            ...(input.minimumAmount !== undefined && { minimumAmount: input.minimumAmount }),
            ...(input.maximumDiscount !== undefined && { maximumDiscount: input.maximumDiscount }),
            ...(input.usageLimit !== undefined && { usageLimit: input.usageLimit }),
            ...(input.validFrom && { validFrom: new Date(input.validFrom) }),
            ...(input.validUntil && { validUntil: new Date(input.validUntil) }),
            ...(input.isActive !== undefined && { isActive: input.isActive }),
            ...(input.isFirstTimeOnly !== undefined && { isFirstTimeOnly: input.isFirstTimeOnly }),
            ...(input.applicableCategories && { applicableCategories: input.applicableCategories }),
            ...(input.applicableProducts && { applicableProducts: input.applicableProducts }),
          };
          const c = await updateCouponUseCase.execute(id, updateData, context.currentUser!);
          return transformCoupon(c);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      deleteCoupon: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'Coupon', 'unlink');
        try {
          return await deleteCouponUseCase.execute(id, context.currentUser!);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Carriers ─────────────────────────────────────────────────────────
      createCarrier: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'Carrier', 'create');
        try {
          const c = await createCarrierUseCase.execute(
            {
              name: input.name,
              code: input.code,
              trackingUrlTemplate: input.trackingUrlTemplate,
              isActive: input.isActive ?? true,
            },
            context.currentUser!,
          );
          return transformCarrier(c);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      updateCarrier: async (_: any, { id, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'Carrier', 'write');
        try {
          const c = await updateCarrierUseCase.execute(
            id,
            {
              name: input.name,
              code: input.code,
              trackingUrlTemplate: input.trackingUrlTemplate,
              isActive: input.isActive,
            },
            context.currentUser!,
          );
          return transformCarrier(c);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      deleteCarrier: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'Carrier', 'unlink');
        try {
          return await deleteCarrierUseCase.execute(id, context.currentUser!);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Shipping zones ────────────────────────────────────────────────────
      createShippingZone: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'ShippingZone', 'create');
        try {
          const z = await createShippingZoneUseCase.execute(
            {
              name: input.name,
              countries: input.countries,
              states: input.states || [],
              cities: input.cities || [],
              postalCodes: input.postalCodes || [],
              isActive: input.isActive ?? true,
            },
            context.currentUser!,
          );
          return transformShippingZone(z);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      updateShippingZone: async (_: any, { id, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'ShippingZone', 'write');
        try {
          const z = await updateShippingZoneUseCase.execute(
            id,
            {
              name: input.name,
              countries: input.countries,
              states: input.states,
              cities: input.cities,
              postalCodes: input.postalCodes,
              isActive: input.isActive,
            },
            context.currentUser!,
          );
          return transformShippingZone(z);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      deleteShippingZone: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'ShippingZone', 'unlink');
        try {
          return await deleteShippingZoneUseCase.execute(id, context.currentUser!);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Shipping rates ────────────────────────────────────────────────────
      createShippingRate: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'ShippingRate', 'create');
        try {
          const r = await createShippingRateUseCase.execute(
            {
              zoneId: input.zoneId,
              name: input.name,
              minWeight: input.minWeight != null ? String(input.minWeight) : undefined,
              maxWeight: input.maxWeight != null ? String(input.maxWeight) : undefined,
              price: String(input.price),
              isActive: input.isActive ?? true,
            },
            context.currentUser!,
          );
          return transformShippingRate(r);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      updateShippingRate: async (_: any, { id, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'ShippingRate', 'write');
        try {
          const r = await updateShippingRateUseCase.execute(
            id,
            {
              name: input.name,
              minWeight: input.minWeight !== undefined ? (input.minWeight != null ? String(input.minWeight) : null) : undefined,
              maxWeight: input.maxWeight !== undefined ? (input.maxWeight != null ? String(input.maxWeight) : null) : undefined,
              price: input.price != null ? String(input.price) : undefined,
              isActive: input.isActive,
            },
            context.currentUser!,
          );
          return transformShippingRate(r);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      deleteShippingRate: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'ShippingRate', 'unlink');
        try {
          return await deleteShippingRateUseCase.execute(id, context.currentUser!);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Delivery slots ─────────────────────────────────────────────────────
      createDeliverySlot: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'DeliverySlot', 'create');
        try {
          const s = await createDeliverySlotUseCase.execute(
            {
              dayOfWeek: input.dayOfWeek,
              startTime: input.startTime,
              endTime: input.endTime,
              maxOrders: input.maxOrders,
              isActive: input.isActive ?? true,
            },
            context.currentUser!,
          );
          return transformDeliverySlot(s);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      updateDeliverySlot: async (_: any, { id, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'DeliverySlot', 'write');
        try {
          const s = await updateDeliverySlotUseCase.execute(
            id,
            {
              dayOfWeek: input.dayOfWeek,
              startTime: input.startTime,
              endTime: input.endTime,
              maxOrders: input.maxOrders,
              isActive: input.isActive,
            },
            context.currentUser!,
          );
          return transformDeliverySlot(s);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      deleteDeliverySlot: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'DeliverySlot', 'unlink');
        try {
          return await deleteDeliverySlotUseCase.execute(id, context.currentUser!);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      // ── Tax rates ─────────────────────────────────────────────────────────
      createTaxRate: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'TaxRate', 'create');
        try {
          const r = await createTaxRateUseCase.execute(
            {
              name: input.name,
              rate: String(input.rate),
              country: input.country,
              state: input.state,
              city: input.city,
              isActive: input.isActive ?? true,
            },
            context.currentUser!,
          );
          return transformTaxRate(r);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      updateTaxRate: async (_: any, { id, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'TaxRate', 'write');
        try {
          const r = await updateTaxRateUseCase.execute(
            id,
            {
              name: input.name,
              rate: input.rate != null ? String(input.rate) : undefined,
              country: input.country,
              state: input.state,
              city: input.city,
              isActive: input.isActive,
            },
            context.currentUser!,
          );
          return transformTaxRate(r);
        } catch (error) {
          return mapDomainError(error);
        }
      },

      deleteTaxRate: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'TaxRate', 'unlink');
        try {
          return await deleteTaxRateUseCase.execute(id, context.currentUser!);
        } catch (error) {
          return mapDomainError(error);
        }
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

    User: {
      /**
       * Required by Apollo Federation for any type that extends a stub entity from
       * another subgraph.  The gateway calls __resolveReference to materialize the
       * User representation in order-service before it resolves extension fields like
       * `orders`.  We simply echo the id back — order-service owns no User fields, only
       * the `orders` extension.  No auth guard here: federation internal routing, not
       * a client-facing resolver.
       */
      __resolveReference: ({ id }: { id: string }) => ({ id }),

      /**
       * Resolves User.orders when the gateway composes the User entity from order-service.
       * The parent object carries the `id` field (the user's id).
       * Authentication context is forwarded by the gateway; unauthenticated callers
       * receive an empty list (no error, no data leakage).
       */
      orders: async (parent: { id: string }, args: { limit?: number; offset?: number }, context: any) => {
        if (!context?.currentUser) return [];
        // BOLA guard: owner sees only their own orders; management roles can see any user's orders.
        // Non-owner non-management callers receive an empty list (no enumeration leak).
        const isOwner = context.currentUser.userId === parent.id;
        if (!isOwner) {
          try {
            assertOrderManagementAccess(context.currentUser);
          } catch {
            return [];
          }
        }
        const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
        const offset = Math.max(args.offset ?? 0, 0);
        const orders = await orderRepository.findAll(
          { userId: parent.id, limit, offset },
          context.currentUser,
        );
        return orders.map(transformOrder);
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
