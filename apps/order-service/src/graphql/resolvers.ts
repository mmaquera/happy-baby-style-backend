import { PrismaClient } from '@prisma/client';
import { IOrderRepository } from '../domain/repositories/IOrderRepository';
import { IProductValidationPort } from '../domain/ports/IProductValidationPort';
import { IEventPublisher } from '../domain/ports/IEventPublisher';
import { CreateOrderUseCase } from '../application/use-cases/CreateOrderUseCase';
import { GetOrdersUseCase } from '../application/use-cases/GetOrdersUseCase';
import { GetOrderByIdUseCase } from '../application/use-cases/GetOrderByIdUseCase';
import { UpdateOrderUseCase } from '../application/use-cases/UpdateOrderUseCase';
import { GetOrderStatsUseCase } from '../application/use-cases/GetOrderStatsUseCase';
import { ResponseFactory, RESPONSE_CODES } from '@hbs/shared-kernel';
import { GraphQLError } from 'graphql';
import { requirePermission, requireRole, Permission, UserRole, TokenPayload } from '@hbs/auth';

// ── Local hybrid guard (Fase 5.9) ────────────────────────────────────────────
// Supports BOTH new tokens (with `groups`) and legacy tokens (role only).
// Used for admin-scoped order listings that were previously STAFF/ADMIN only.
const ORDER_MANAGEMENT_GROUPS = [
  'administrators',
  'sales-manager',
  'sales-user',
  'customer-service',
] as const;

/**
 * Grants access to administrative order listings.
 * Passes when the user belongs to any order management group (new token)
 * OR has role ADMIN/STAFF (legacy token without groups).
 * CUSTOMER + no management group → FORBIDDEN.
 */
function requireOrderManagementAccess(
  currentUser: TokenPayload | null | undefined,
): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  // New token path: group-based check
  if (currentUser.groups?.some((g) => (ORDER_MANAGEMENT_GROUPS as readonly string[]).includes(g))) {
    return;
  }
  // Legacy token path: role-based fallback
  if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.STAFF) {
    return;
  }
  throw new GraphQLError('Insufficient privileges', {
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });
}

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

export function createResolvers(
  orderRepository: IOrderRepository,
  productValidation: IProductValidationPort,
  eventPublisher: IEventPublisher,
  prisma: PrismaClient,
) {
  const createOrderUseCase = new CreateOrderUseCase(
    orderRepository,
    productValidation,
    eventPublisher,
  );
  const getOrdersUseCase = new GetOrdersUseCase(orderRepository);
  const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);
  const updateOrderUseCase = new UpdateOrderUseCase(orderRepository);
  const getOrderStatsUseCase = new GetOrderStatsUseCase(orderRepository);

  return {
    Query: {
      // ── Orders ──────────────────────────────────────────────────────────
      orders: async (_: any, { filter, pagination }: any, context: any) => {
        requireOrderManagementAccess(context.currentUser);
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
        const order = await getOrderByIdUseCase.execute(id, context.currentUser ?? null);
        return order ? transformOrder(order) : null;
      },

      orderStats: async () => getOrderStatsUseCase.execute(),

      ordersByStatus: async (_: any, { status }: { status: string }, context: any) => {
        requireOrderManagementAccess(context.currentUser);
        const orders = await orderRepository.findByStatus(status);
        return orders.map(transformOrder);
      },

      // ── Payment methods ──────────────────────────────────────────────────
      userPaymentMethods: async (_: any, { userId }: { userId: string }) => {
        const pms = await prisma.paymentMethod.findMany({
          where: { order: { userId } },
          orderBy: { createdAt: 'desc' },
        });
        return pms.map(transformPaymentMethod);
      },

      paymentMethod: async (_: any, { id }: { id: string }) => {
        const pm = await prisma.paymentMethod.findUnique({ where: { id } });
        return pm ? transformPaymentMethod(pm) : null;
      },

      // ── Transactions ─────────────────────────────────────────────────────
      userTransactions: async (_: any, { userId }: { userId: string }) => {
        const txs = await prisma.transaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
        return txs.map(transformTransaction);
      },

      transaction: async (_: any, { id }: { id: string }) => {
        const tx = await prisma.transaction.findUnique({ where: { id } });
        return tx ? transformTransaction(tx) : null;
      },

      // ── Coupons ──────────────────────────────────────────────────────────
      coupons: async () => {
        const items = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
        return items.map(transformCoupon);
      },

      coupon: async (_: any, { id }: { id: string }) => {
        const c = await prisma.coupon.findUnique({ where: { id } });
        return c ? transformCoupon(c) : null;
      },

      couponByCode: async (_: any, { code }: { code: string }) => {
        const c = await prisma.coupon.findUnique({ where: { code } });
        return c ? transformCoupon(c) : null;
      },

      activeCoupons: async () => {
        const now = new Date();
        const items = await prisma.coupon.findMany({
          where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
          orderBy: { createdAt: 'desc' },
        });
        return items.map(transformCoupon);
      },

      userCouponUsage: async (_: any, { userId }: { userId: string }) => {
        const items = await prisma.couponUsage.findMany({
          where: { userId },
          orderBy: { usedAt: 'desc' },
        });
        return items.map(transformCouponUsage);
      },

      // ── Shipping & logistics ─────────────────────────────────────────────
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

      userCart: async (_: any, { userId }: any) => {
        try {
          const carts = await prisma.shoppingCart.findMany({
            where: { userId },
            include: { items: true },
          });
          return carts.map((c) => ({
            ...c,
            items: c.items.map((i) => ({
              ...i,
              price: Number(i.price),
              cart: { __typename: 'ShoppingCart', id: i.cartId },
              product: { __typename: 'Product', id: i.productId },
            })),
          }));
        } catch {
          return [];
        }
      },

      cartItem: async (_: any, { id }: any) => {
        try {
          const item = await prisma.shoppingCartItem.findUnique({ where: { id } });
          if (!item) return null;
          return {
            ...item,
            price: Number(item.price),
            cart: { __typename: 'ShoppingCart', id: item.cartId },
            product: { __typename: 'Product', id: item.productId },
          };
        } catch {
          return null;
        }
      },

      // ── Store settings & tax rates queries ───────────────────────────────

      storeSettings: async () => {
        try {
          return await prisma.storeSettings.findMany({ where: { isActive: true } });
        } catch {
          return [];
        }
      },

      storeSetting: async (_: any, { key }: any) => {
        try {
          return await prisma.storeSettings.findUnique({ where: { settingKey: key } });
        } catch {
          return null;
        }
      },

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
        const order = await updateOrderUseCase.execute(id, {
          status: input.status,
          customerEmail: input.customerEmail,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
        });
        return transformOrder(order);
      },

      updateOrderStatus: async (_: any, { id, status }: { id: string; status: string }, context: any) => {
        requirePermission(context.currentUser, Permission.UPDATE_ORDER);
        const order = await updateOrderUseCase.execute(id, { status: status as any });
        return transformOrder(order);
      },

      deleteOrder: async (_: any, { id }: { id: string }, context: any) => {
        requireRole(context.currentUser, UserRole.ADMIN);
        return orderRepository.delete(id);
      },

      bulkUpdateOrderStatus: async (
        _: any,
        { orders, status }: { orders: string[]; status: string },
        context: any,
      ) => {
        requirePermission(context.currentUser, Permission.UPDATE_ORDER);
        const updated = await Promise.all(
          orders.map((id) => updateOrderUseCase.execute(id, { status: status as any })),
        );
        return updated.map(transformOrder);
      },

      // ── Payment methods ──────────────────────────────────────────────────
      createPaymentMethod: async (_: any, { input }: any) => {
        const pm = await prisma.paymentMethod.create({
          data: {
            orderId: input.orderId,
            type: input.type,
            amount: input.amount,
            status: input.status || 'pending',
            transactionId: input.transactionId,
            metadata: input.metadata || {},
          },
        });
        return transformPaymentMethod(pm);
      },

      updatePaymentMethod: async (_: any, { id, input }: any) => {
        const updateData: any = {};
        if (input.type) updateData.type = input.type;
        if (input.amount != null) updateData.amount = input.amount;
        if (input.status) updateData.status = input.status;
        if (input.transactionId !== undefined) updateData.transactionId = input.transactionId;
        if (input.metadata) updateData.metadata = input.metadata;
        const pm = await prisma.paymentMethod.update({ where: { id }, data: updateData });
        return transformPaymentMethod(pm);
      },

      deletePaymentMethod: async (_: any, { id }: { id: string }) => {
        await prisma.paymentMethod.delete({ where: { id } });
        return true;
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

      updateCarrier: async (_: any, { id, name, code, trackingUrlTemplate, isActive }: any, context: any) => {
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

      addToCart: async (_: any, { userId, productId, quantity }: any) => {
        let cart = await prisma.shoppingCart.findFirst({ where: { userId } });
        if (!cart) {
          cart = await prisma.shoppingCart.create({ data: { userId } });
        }
        const existing = await prisma.shoppingCartItem.findFirst({
          where: { cartId: cart.id, productId },
        });
        if (existing) {
          const item = await prisma.shoppingCartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + quantity },
          });
          return { ...item, cart: { __typename: 'ShoppingCart', id: item.cartId }, product: { __typename: 'Product', id: item.productId } };
        }
        const item = await prisma.shoppingCartItem.create({
          data: { cartId: cart.id, productId, quantity, price: 0 },
        });
        return { ...item, cart: { __typename: 'ShoppingCart', id: item.cartId }, product: { __typename: 'Product', id: item.productId } };
      },

      updateCartItem: async (_: any, { id, quantity }: any) => {
        const item = await prisma.shoppingCartItem.update({ where: { id }, data: { quantity } });
        return { ...item, cart: { __typename: 'ShoppingCart', id: item.cartId }, product: { __typename: 'Product', id: item.productId } };
      },

      removeFromCart: async (_: any, { id }: any) => {
        try {
          await prisma.shoppingCartItem.delete({ where: { id } });
          return { success: true, message: 'Item removed from cart' };
        } catch (e: any) {
          return { success: false, message: e.message };
        }
      },

      clearUserCart: async (_: any, { userId }: any) => {
        try {
          const carts = await prisma.shoppingCart.findMany({ where: { userId } });
          for (const cart of carts) {
            await prisma.shoppingCartItem.deleteMany({ where: { cartId: cart.id } });
          }
          return { success: true, message: 'Cart cleared' };
        } catch (e: any) {
          return { success: false, message: e.message };
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
