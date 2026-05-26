import { IOrderRepository } from '../domain/repositories/IOrderRepository';
import { IProductValidationPort } from '../domain/ports/IProductValidationPort';
import { IEventPublisher } from '../domain/ports/IEventPublisher';
import { CreateOrderUseCase } from '../application/use-cases/CreateOrderUseCase';
import { GetOrdersUseCase } from '../application/use-cases/GetOrdersUseCase';
import { GetOrderByIdUseCase } from '../application/use-cases/GetOrderByIdUseCase';
import { UpdateOrderUseCase } from '../application/use-cases/UpdateOrderUseCase';
import { GetOrderStatsUseCase } from '../application/use-cases/GetOrderStatsUseCase';
import { ResponseFactory, RESPONSE_CODES } from '@hbs/shared-kernel';

function transformOrder(order: any) {
  return {
    ...order,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
    updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : order.updatedAt,
    deliveredAt: order.deliveredAt instanceof Date ? order.deliveredAt.toISOString() : order.deliveredAt,
    items: (order.items || []).map((item: any) => ({
      ...item,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt
    }))
  };
}

export function createResolvers(
  orderRepository: IOrderRepository,
  productValidation: IProductValidationPort,
  eventPublisher: IEventPublisher
) {
  const createOrderUseCase = new CreateOrderUseCase(orderRepository, productValidation, eventPublisher);
  const getOrdersUseCase = new GetOrdersUseCase(orderRepository);
  const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);
  const updateOrderUseCase = new UpdateOrderUseCase(orderRepository);
  const getOrderStatsUseCase = new GetOrderStatsUseCase(orderRepository);

  return {
    Query: {
      orders: async (_: any, { filter, pagination }: any) => {
        const result = await getOrdersUseCase.execute({
          filters: filter,
          pagination
        });
        return {
          orders: result.orders.map(transformOrder),
          total: result.total,
          hasMore: result.hasMore
        };
      },

      order: async (_: any, { id }: { id: string }) => {
        const order = await getOrderByIdUseCase.execute(id);
        return order ? transformOrder(order) : null;
      },

      orderStats: async () => {
        return getOrderStatsUseCase.execute();
      },

      ordersByStatus: async (_: any, { status }: { status: string }) => {
        const orders = await orderRepository.findByStatus(status);
        return orders.map(transformOrder);
      }
    },

    Mutation: {
      createOrder: async (_: any, { input }: { input: any }, context: any) => {
        const userId = context?.req?.headers?.['x-user-id'] as string | undefined;
        const order = await createOrderUseCase.execute({
          customerEmail: input.customerEmail,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          items: input.items,
          shippingAddress: input.shippingAddress
        });
        return transformOrder(order);
      },

      updateOrder: async (_: any, { id, input }: { id: string; input: any }) => {
        const order = await updateOrderUseCase.execute(id, {
          status: input.status,
          customerEmail: input.customerEmail,
          customerName: input.customerName,
          customerPhone: input.customerPhone
        });
        return transformOrder(order);
      },

      updateOrderStatus: async (_: any, { id, status }: { id: string; status: string }) => {
        const order = await updateOrderUseCase.execute(id, { status: status as any });
        return transformOrder(order);
      },

      deleteOrder: async (_: any, { id }: { id: string }) => {
        return orderRepository.delete(id);
      },

      bulkUpdateOrderStatus: async (_: any, { orders, status }: { orders: string[]; status: string }) => {
        const updated = await Promise.all(
          orders.map(id => updateOrderUseCase.execute(id, { status: status as any }))
        );
        return updated.map(transformOrder);
      }
    },

    Order: {
      __resolveReference: async ({ id }: { id: string }) => {
        const order = await orderRepository.findById(id);
        return order ? transformOrder(order) : null;
      },
      user: (parent: any) => ({ __typename: 'User', id: parent.userId }),
      items: async (parent: any) => {
        if (parent.items?.length) return parent.items;
        const items = await orderRepository.getOrderItems(parent.id);
        return items.map((item: any) => ({
          ...item,
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt
        }));
      }
    },

    OrderItem: {
      __resolveReference: async ({ id }: { id: string }) => {
        const items = await orderRepository.getOrderItems(id);
        return items[0] || null;
      },
      product: (parent: any) => ({ __typename: 'Product', id: parent.productId }),
      order: async (parent: any) => {
        const order = await orderRepository.findById(parent.orderId);
        return order ? transformOrder(order) : null;
      }
    }
  };
}
