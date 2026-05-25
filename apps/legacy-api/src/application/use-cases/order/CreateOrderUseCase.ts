import { IOrderRepository } from '@domain/repositories/IOrderRepository';
import { IProductRepository } from '@domain/repositories/IProductRepository';
import { CreateOrderRequest, Order, OrderEntity } from '@domain/entities/Order';

export class CreateOrderUseCase {
  constructor(
    private orderRepository: IOrderRepository,
    private productRepository: IProductRepository
  ) {}

  async execute(orderData: CreateOrderRequest): Promise<Order> {
    try {
      // Validar que todos los productos existan y tengan stock
      const productValidations = await Promise.all(
        orderData.items.map(async (item) => {
          const product = await this.productRepository.findById(item.productId);
          if (!product) {
            throw new Error(`Product with ID ${item.productId} not found`);
          }
          if (!product.isActive) {
            throw new Error(`Product ${product.name} is not active`);
          }
          
          // Verificar stock total del producto
          const totalStock = product.getTotalStock();
          if (totalStock < item.quantity) {
            throw new Error(`Insufficient stock for product ${product.name}. Available: ${totalStock}, Requested: ${item.quantity}`);
          }
          
          // Verificar si la variante específica existe y tiene stock
          const variant = product.variants?.find(v => 
            v.size === item.size && v.color === item.color && v.isActive
          );
          
          if (!variant) {
            throw new Error(`Variant with size ${item.size} and color ${item.color} not available for product ${product.name}`);
          }
          
          if (variant.stockQuantity < item.quantity) {
            throw new Error(`Insufficient stock for variant ${item.size}/${item.color} of product ${product.name}. Available: ${variant.stockQuantity}, Requested: ${item.quantity}`);
          }
          
          return { product, variant, item };
        })
      );

      // Calcular total del pedido
      const total = productValidations.reduce((sum, { product, variant, item }) => {
        const itemPrice = variant.price || product.price;
        return sum + (itemPrice * item.quantity);
      }, 0);

      // Crear el pedido con el total calculado
      const orderWithTotal = {
        ...orderData,
        total
      };

      // Crear el pedido en el repositorio
      const order = await this.orderRepository.create(orderWithTotal);

      // Actualizar stock de variantes de productos
      await Promise.all(
        productValidations.map(async ({ variant, item }) => {
          const newStock = variant.stockQuantity - item.quantity;
          // TODO: Implementar actualización de variantes en el repositorio
          // await this.productRepository.updateVariant(variant.id, { stockQuantity: newStock });
        })
      );

      return order;
    } catch (error) {
      throw new Error(`Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 