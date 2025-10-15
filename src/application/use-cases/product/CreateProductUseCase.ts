import { ProductEntity } from '@domain/entities/Product';
import { IProductRepository } from '@domain/repositories/IProductRepository';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';
import { PerformanceLogger } from '@infrastructure/logging/PerformanceLogger';
import { 
  RequiredFieldError, 
  InvalidRangeError, 
  DuplicateError, 
  BusinessLogicError,
  DatabaseError,
  ValidationError 
} from '@domain/errors/DomainError';

export interface CreateProductRequest {
  categoryId: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  sku: string;
  images?: string[];
  attributes?: Record<string, any>;
  stockQuantity?: number;
  tags?: string[];
  isActive?: boolean;
}

export class CreateProductUseCase {
  private readonly logger: ILogger;
  private readonly performanceLogger: PerformanceLogger;

  constructor(
    private readonly productRepository: IProductRepository
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateProductUseCase');
    this.performanceLogger = new PerformanceLogger();
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    includeError: true,
    context: { useCase: 'CreateProduct' }
  })
  async execute(request: CreateProductRequest): Promise<ProductEntity> {
    const traceId = `create-product-${Date.now()}-${request.sku}`;

    // Log operation start with image analysis
    this.logger.info('Starting product creation process', {
      operation: 'createProduct',
      productName: request.name,
      sku: request.sku,
      categoryId: request.categoryId,
      hasImages: !!(request.images && request.images.length > 0),
      imageCount: request.images?.length || 0,
      context: 'CreateProductUseCase.execute'
    }, traceId);

    // Start performance measurement
    const operationId = this.performanceLogger.startTimer('createProductProcess', {
      productName: request.name,
      sku: request.sku,
      imageCount: request.images?.length || 0
    });

    try {
      // Validación de input usando métodos locales
      this.logger.debug('Validating product input', {
        productName: request.name,
        sku: request.sku,
        hasImages: !!(request.images && request.images.length > 0),
        context: 'CreateProductUseCase.validateInput'
      }, traceId);

      this.validateInput(request);

      // Analyze images if provided
      if (request.images && request.images.length > 0) {
        const blobUrls = request.images.filter(img => img.startsWith('blob:'));
        const validUrls = request.images.filter(img => !img.startsWith('blob:') && (img.startsWith('http') || img.startsWith('/')));
        const invalidUrls = request.images.filter(img => !img.startsWith('blob:') && !img.startsWith('http') && !img.startsWith('/'));

        this.logger.info('Analyzing product images', {
          productName: request.name,
          sku: request.sku,
          totalImages: request.images.length,
          blobUrls: blobUrls.length,
          validUrls: validUrls.length,
          invalidUrls: invalidUrls.length,
          imageList: request.images,
          context: 'CreateProductUseCase.analyzeImages'
        }, traceId);

        if (blobUrls.length > 0) {
          this.logger.warn('Product contains blob URLs - images may not be properly uploaded', {
            productName: request.name,
            sku: request.sku,
            blobCount: blobUrls.length,
            blobUrls: blobUrls,
            recommendation: 'Use uploadImage mutation before createProduct',
            context: 'CreateProductUseCase.analyzeImages'
          }, traceId);
        }

        if (invalidUrls.length > 0) {
          this.logger.warn('Product contains invalid image URLs', {
            productName: request.name,
            sku: request.sku,
            invalidCount: invalidUrls.length,
            invalidUrls: invalidUrls,
            context: 'CreateProductUseCase.analyzeImages'
          }, traceId);
        }
      } else {
        this.logger.info('Product created without images', {
          productName: request.name,
          sku: request.sku,
          context: 'CreateProductUseCase.analyzeImages'
        }, traceId);
      }

      this.logger.debug('Product input validation successful', {
        productName: request.name,
        sku: request.sku,
        context: 'CreateProductUseCase.validateInput'
      }, traceId);

      // Validar que el SKU sea único
      this.logger.debug('Checking SKU uniqueness', {
        sku: request.sku,
        context: 'CreateProductUseCase.checkSku'
      }, traceId);

      const existingProduct = await this.productRepository.findBySku(request.sku);
      if (existingProduct) {
        this.logger.warn('SKU already exists', {
          sku: request.sku,
          existingProductId: existingProduct.id,
          context: 'CreateProductUseCase.checkSku'
        }, traceId);
        throw new DuplicateError('Product', 'SKU', request.sku);
      }

      this.logger.debug('SKU is unique, proceeding with creation', {
        sku: request.sku,
        context: 'CreateProductUseCase.checkSku'
      }, traceId);

      // Crear producto
      const product = ProductEntity.create({
        categoryId: request.categoryId,
        name: request.name.trim(),
        description: request.description.trim(),
        price: request.price,
        salePrice: request.salePrice,
        sku: request.sku.trim().toUpperCase(),
        images: request.images || [],
        attributes: request.attributes || {},
        isActive: request.isActive ?? true,
        stockQuantity: request.stockQuantity || 0,
        tags: request.tags
      });

      this.logger.debug('Product entity created', {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        imageCount: product.images.length,
        context: 'CreateProductUseCase.createEntity'
      }, traceId);

      this.logger.info('Saving product to database', {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        context: 'CreateProductUseCase.saveProduct'
      }, traceId);

      const savedProduct = await this.productRepository.create(product);

      // End performance measurement
      const measurement = this.performanceLogger.endTimer(operationId, {
        success: true,
        productId: savedProduct.id,
        productName: savedProduct.name
      });

      this.logger.info('Product creation process completed successfully', {
        productId: savedProduct.id,
        productName: savedProduct.name,
        sku: savedProduct.sku,
        imageCount: savedProduct.images.length,
        duration: measurement?.duration,
        context: 'CreateProductUseCase.execute'
      }, traceId);

      return savedProduct;
    } catch (error) {
      // End performance measurement with error
      this.performanceLogger.endTimer(operationId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.logger.error('Product creation process failed', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'createProduct',
        productName: request.name,
        sku: request.sku,
        categoryId: request.categoryId,
        imageCount: request.images?.length || 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'CreateProductUseCase.execute'
      }, traceId);

      // Re-throw validation and domain errors as-is
      if (error instanceof ValidationError || 
          error instanceof DuplicateError || 
          error instanceof BusinessLogicError) {
        throw error;
      }
      
      // Wrap infrastructure errors
      if (error instanceof Error) {
        throw new DatabaseError('create product', error);
      }
      
      throw new DatabaseError('create product');
    }
  }

  private validateInput(request: CreateProductRequest): void {
    // Validar campos obligatorios
    this.validateRequired('categoryId', request.categoryId);
    this.validateRequired('name', request.name);
    this.validateRequired('description', request.description);
    this.validateRequired('price', request.price);
    this.validateRequired('sku', request.sku);

    // Validar nombre
    this.validateString('name', request.name, { minLength: 1, maxLength: 255 });

    // Validar descripción
    this.validateString('description', request.description, { maxLength: 2000 });

    // Validar SKU
    this.validateString('sku', request.sku, { 
      minLength: 1, 
      maxLength: 50,
      pattern: /^[A-Z0-9\-_]+$/
    });

    // Validar precio
    this.validateNumber('price', request.price, { min: 0.01 });

    // Validar precio de venta si se proporciona
    if (request.salePrice !== undefined) {
      this.validateNumber('salePrice', request.salePrice, { min: 0.01 });
      if (request.salePrice >= request.price) {
        throw new ValidationError('Sale price must be less than regular price');
      }
    }

    // Validar cantidad de stock si se proporciona
    if (request.stockQuantity !== undefined) {
      this.validateNumber('stockQuantity', request.stockQuantity, { min: 0, integer: true });
    }

    // Validar imágenes si se proporcionan
    if (request.images !== undefined) {
      this.validateArray('images', request.images, {
        maxLength: 10,
        itemValidator: (item) => {
          this.validateString('image', item, { minLength: 1 });
        }
      });
    }

    // Validar tags si se proporcionan
    if (request.tags !== undefined) {
      this.validateArray('tags', request.tags, {
        maxLength: 20,
        itemValidator: (item) => {
          this.validateString('tag', item, { minLength: 1, maxLength: 50 });
        }
      });
    }
  }

  // Métodos de validación privados
  private validateRequired(field: string, value: any): void {
    if (value === undefined || value === null || 
        (typeof value === 'string' && value.trim().length === 0)) {
      throw new ValidationError(`Field '${field}' is required`);
    }
  }

  private validateString(field: string, value: any, options?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  }): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        throw new ValidationError(`Field '${field}' must be a string`);
      }

      if (options?.minLength && value.length < options.minLength) {
        throw new ValidationError(`Field '${field}' must be at least ${options.minLength} characters long`);
      }

      if (options?.maxLength && value.length > options.maxLength) {
        throw new ValidationError(`Field '${field}' must not exceed ${options.maxLength} characters`);
      }

      if (options?.pattern && !options.pattern.test(value)) {
        throw new ValidationError(`Field '${field}' has an invalid format`);
      }
    }
  }

  private validateNumber(field: string, value: any, options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  }): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(`Field '${field}' must be a number`);
      }

      if (options?.integer && !Number.isInteger(value)) {
        throw new ValidationError(`Field '${field}' must be an integer`);
      }

      if (options?.min !== undefined && value < options.min) {
        throw new ValidationError(`Field '${field}' must be at least ${options.min}`);
      }

      if (options?.max !== undefined && value > options.max) {
        throw new ValidationError(`Field '${field}' must not exceed ${options.max}`);
      }
    }
  }

  private validateArray(field: string, value: any, options?: {
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: any, index: number) => void;
  }): void {
    if (value !== undefined && value !== null) {
      if (!Array.isArray(value)) {
        throw new ValidationError(`Field '${field}' must be an array`);
      }

      if (options?.minLength && value.length < options.minLength) {
        throw new ValidationError(`Field '${field}' must have at least ${options.minLength} items`);
      }

      if (options?.maxLength && value.length > options.maxLength) {
        throw new ValidationError(`Field '${field}' must not exceed ${options.maxLength} items`);
      }

      if (options?.itemValidator) {
        value.forEach((item, index) => {
          try {
            options.itemValidator!(item, index);
          } catch (error) {
            if (error instanceof ValidationError) {
              throw new ValidationError(`${field}[${index}]: ${error.message}`);
            }
            throw error;
          }
        });
      }
    }
  }
}