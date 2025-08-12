import DataLoader from 'dataloader';
import { Container } from '@shared/container';
import { IProductRepository } from '@domain/repositories/IProductRepository';
import { IOrderRepository } from '@domain/repositories/IOrderRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { ProductEntity } from '@domain/entities/Product';
import { CategoryEntity } from '@domain/entities/Product';
import { Order } from '@domain/entities/Order';

export class DataLoaders {
  private container: Container;
  
  // Product loaders
  public readonly productLoader: DataLoader<string, ProductEntity | null>;
  public readonly productsByCategoryLoader: DataLoader<string, ProductEntity[]>;
  public readonly productsBySkuLoader: DataLoader<string, ProductEntity | null>;
  
  // Order loaders
  public readonly orderLoader: DataLoader<string, Order | null>;
  public readonly ordersByUserLoader: DataLoader<string, Order[]>;
  
  // User loaders
  public readonly userLoader: DataLoader<string, any | null>;
  
  // Category loaders
  public readonly categoryLoader: DataLoader<string, CategoryEntity | null>;

  constructor() {
    this.container = Container.getInstance();
    
    // Initialize product loaders
    this.productLoader = new DataLoader(
      async (ids: readonly string[]) => this.batchLoadProducts(ids),
      { cache: true, maxBatchSize: 100 }
    );

    this.productsByCategoryLoader = new DataLoader(
      async (categoryIds: readonly string[]) => this.batchLoadProductsByCategory(categoryIds),
      { cache: true, maxBatchSize: 50 }
    );

    this.productsBySkuLoader = new DataLoader(
      async (skus: readonly string[]) => this.batchLoadProductsBySku(skus),
      { cache: true, maxBatchSize: 100 }
    );

    // Initialize order loaders
    this.orderLoader = new DataLoader(
      async (ids: readonly string[]) => this.batchLoadOrders(ids),
      { cache: true, maxBatchSize: 100 }
    );

    this.ordersByUserLoader = new DataLoader(
      async (userIds: readonly string[]) => this.batchLoadOrdersByUser(userIds),
      { cache: true, maxBatchSize: 50 }
    );

    // Initialize user loaders
    this.userLoader = new DataLoader(
      async (ids: readonly string[]) => this.batchLoadUsers(ids),
      { cache: true, maxBatchSize: 100 }
    );

    // Initialize category loaders
    this.categoryLoader = new DataLoader(
      async (ids: readonly string[]) => this.batchLoadCategories(ids),
      { cache: true, maxBatchSize: 100 }
    );
  }

  // Product batch loaders
  private async batchLoadProducts(ids: readonly string[]): Promise<(ProductEntity | null)[]> {
    try {
      const productRepository = this.container.get<IProductRepository>('productRepository');
      
      // Create a map for fast lookup
      const productMap = new Map<string, ProductEntity>();
      
      // Batch load all products - this would ideally be implemented in the repository
      // For now, we'll load them one by one, but in a real implementation,
      // you'd add a batchFindByIds method to the repository
      for (const id of ids) {
        const product = await productRepository.findById(id);
        if (product) {
          productMap.set(id, product);
        }
      }

      // Return results in the same order as requested
      return ids.map(id => productMap.get(id) || null);
    } catch (error) {
      console.error('Error in batchLoadProducts:', error);
      return ids.map(() => null);
    }
  }

  private async batchLoadProductsByCategory(categoryIds: readonly string[]): Promise<ProductEntity[][]> {
    try {
      const productRepository = this.container.get<IProductRepository>('productRepository');
      
      // Create a map for fast lookup
      const productsByCategory = new Map<string, ProductEntity[]>();
      
      // Initialize empty arrays for all categories
      categoryIds.forEach(categoryId => {
        productsByCategory.set(categoryId, []);
      });

      // Batch load products by categories
      for (const categoryId of categoryIds) {
        const products = await productRepository.findByCategory(categoryId);
        productsByCategory.set(categoryId, products);
      }

      // Return results in the same order as requested
      return categoryIds.map(categoryId => productsByCategory.get(categoryId) || []);
    } catch (error) {
      console.error('Error in batchLoadProductsByCategory:', error);
      return categoryIds.map(() => []);
    }
  }

  private async batchLoadProductsBySku(skus: readonly string[]): Promise<(ProductEntity | null)[]> {
    try {
      const productRepository = this.container.get<IProductRepository>('productRepository');
      
      const productMap = new Map<string, ProductEntity>();
      
      for (const sku of skus) {
        const product = await productRepository.findBySku(sku);
        if (product) {
          productMap.set(sku, product);
        }
      }

      return skus.map(sku => productMap.get(sku) || null);
    } catch (error) {
      console.error('Error in batchLoadProductsBySku:', error);
      return skus.map(() => null);
    }
  }

  // Order batch loaders
  private async batchLoadOrders(ids: readonly string[]): Promise<(Order | null)[]> {
    try {
      const orderRepository = this.container.get<IOrderRepository>('orderRepository');
      
      const orderMap = new Map<string, Order>();
      
      for (const id of ids) {
        const order = await orderRepository.findById(id);
        if (order) {
          orderMap.set(id, order);
        }
      }

      return ids.map(id => orderMap.get(id) || null);
    } catch (error) {
      console.error('Error in batchLoadOrders:', error);
      return ids.map(() => null);
    }
  }

  private async batchLoadOrdersByUser(userIds: readonly string[]): Promise<Order[][]> {
    try {
      const orderRepository = this.container.get<IOrderRepository>('orderRepository');
      
      const ordersByUser = new Map<string, Order[]>();
      
      // Initialize empty arrays for all users
      userIds.forEach(userId => {
        ordersByUser.set(userId, []);
      });

      // Load orders for each user
      for (const userId of userIds) {
        const orders = await orderRepository.findAll({ userId, limit: 100, offset: 0 });
        ordersByUser.set(userId, orders);
      }

      return userIds.map(userId => ordersByUser.get(userId) || []);
    } catch (error) {
      console.error('Error in batchLoadOrdersByUser:', error);
      return userIds.map(() => []);
    }
  }

  // User batch loaders
  private async batchLoadUsers(ids: readonly string[]): Promise<(any | null)[]> {
    try {
      const userRepository = this.container.get<IUserRepository>('userRepository');
      
      const userMap = new Map<string, any>();
      
      for (const id of ids) {
        const user = await userRepository.getUserById(id);
        if (user) {
          userMap.set(id, user);
        }
      }

      return ids.map(id => userMap.get(id) || null);
    } catch (error) {
      console.error('Error in batchLoadUsers:', error);
      return ids.map(() => null);
    }
  }

  // Category batch loaders
  private async batchLoadCategories(ids: readonly string[]): Promise<(CategoryEntity | null)[]> {
    try {
      const categoryRepository = this.container.get<ICategoryRepository>('categoryRepository');
      
      const categoryMap = new Map<string, CategoryEntity>();
      
      for (const id of ids) {
        const category = await categoryRepository.findById(id);
        if (category) {
          categoryMap.set(id, category);
        }
      }

      return ids.map(id => categoryMap.get(id) || null);
    } catch (error) {
      console.error('Error in batchLoadCategories:', error);
      return ids.map(() => null);
    }
  }

  // Clear all caches (useful for testing or when data changes)
  clearAll(): void {
    this.productLoader.clearAll();
    this.productsByCategoryLoader.clearAll();
    this.productsBySkuLoader.clearAll();
    this.orderLoader.clearAll();
    this.ordersByUserLoader.clearAll();
    this.userLoader.clearAll();
    this.categoryLoader.clearAll();
  }

  // Clear specific cache entry
  clearProduct(id: string): void {
    this.productLoader.clear(id);
  }

  clearOrder(id: string): void {
    this.orderLoader.clear(id);
  }

  clearUser(id: string): void {
    this.userLoader.clear(id);
  }
}