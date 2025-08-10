/**
 * Sistema de manejo de errores centralizado para GraphQL
 * Proporciona funciones para manejar errores de manera consistente
 */

export interface GraphQLErrorResponse {
  success: boolean;
  message: string;
  code?: string;
  details?: any;
}

export class GraphQLErrorHandler {
  /**
   * Maneja errores de base de datos
   */
  static handleDatabaseError(error: any): GraphQLErrorResponse {
    console.error('Database error:', error);
    
    if (error.code === 'P2002') {
      return {
        success: false,
        message: 'Duplicate entry found',
        code: 'DUPLICATE_ENTRY',
        details: error.meta?.target
      };
    }
    
    if (error.code === 'P2025') {
      return {
        success: false,
        message: 'Record not found',
        code: 'NOT_FOUND',
        details: error.meta?.cause
      };
    }
    
    if (error.code === 'P2003') {
      return {
        success: false,
        message: 'Foreign key constraint failed',
        code: 'FOREIGN_KEY_ERROR',
        details: error.meta?.field_name
      };
    }
    
    return {
      success: false,
      message: 'Database operation failed',
      code: 'DATABASE_ERROR',
      details: error.message
    };
  }

  /**
   * Maneja errores de validación
   */
  static handleValidationError(error: any): GraphQLErrorResponse {
    console.error('Validation error:', error);
    
    return {
      success: false,
      message: error.message || 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.details || error.errors
    };
  }

  /**
   * Maneja errores de autenticación
   */
  static handleAuthError(error: any): GraphQLErrorResponse {
    console.error('Authentication error:', error);
    
    return {
      success: false,
      message: error.message || 'Authentication failed',
      code: 'AUTH_ERROR',
      details: error.details
    };
  }

  /**
   * Maneja errores de autorización
   */
  static handleAuthorizationError(error: any): GraphQLErrorResponse {
    console.error('Authorization error:', error);
    
    return {
      success: false,
      message: error.message || 'Access denied',
      code: 'AUTHORIZATION_ERROR',
      details: error.details
    };
  }

  /**
   * Maneja errores genéricos
   */
  static handleGenericError(error: any): GraphQLErrorResponse {
    console.error('Generic error:', error);
    
    return {
      success: false,
      message: error.message || 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }

  /**
   * Función principal para manejar cualquier tipo de error
   */
  static handleError(error: any): GraphQLErrorResponse {
    // Errores de Prisma
    if (error.code && error.code.startsWith('P')) {
      return this.handleDatabaseError(error);
    }
    
    // Errores de validación
    if (error.name === 'ValidationError' || error.type === 'validation') {
      return this.handleValidationError(error);
    }
    
    // Errores de autenticación
    if (error.name === 'AuthenticationError' || error.code === 'AUTH_ERROR') {
      return this.handleAuthError(error);
    }
    
    // Errores de autorización
    if (error.name === 'AuthorizationError' || error.code === 'AUTHORIZATION_ERROR') {
      return this.handleAuthorizationError(error);
    }
    
    // Errores genéricos
    return this.handleGenericError(error);
  }

  /**
   * Wrapper para funciones async que maneja errores automáticamente
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    fallbackValue?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const errorResponse = this.handleError(error);
      console.error('Operation failed:', errorResponse);
      
      if (fallbackValue !== undefined) {
        return fallbackValue;
      }
      
      throw new Error(errorResponse.message);
    }
  }

  /**
   * Crea una respuesta de error consistente para GraphQL
   */
  static createErrorResponse(message: string, code?: string, details?: any): GraphQLErrorResponse {
    return {
      success: false,
      message,
      code,
      details
    };
  }

  /**
   * Crea una respuesta de éxito consistente para GraphQL
   */
  static createSuccessResponse(message: string, data?: any): any {
    return {
      success: true,
      message,
      ...(data && { data })
    };
  }
}

/**
 * Decorador para manejar errores en resolvers
 */
export function withErrorHandling<T extends any[], R>(
  target: any,
  propertyKey: string,
  descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: T): Promise<R> {
    try {
      return await originalMethod!.apply(this, args);
    } catch (error) {
      const errorResponse = GraphQLErrorHandler.handleError(error);
      console.error(`Error in ${propertyKey}:`, errorResponse);
      throw new Error(errorResponse.message);
    }
  };

  return descriptor;
}

/**
 * Función helper para manejar errores en resolvers
 */
export function handleResolverError(error: any, operation: string): never {
  const errorResponse = GraphQLErrorHandler.handleError(error);
  console.error(`Error in ${operation}:`, errorResponse);
  throw new Error(errorResponse.message);
}

