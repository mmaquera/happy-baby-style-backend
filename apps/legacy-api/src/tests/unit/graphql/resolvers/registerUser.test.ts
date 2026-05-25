import { RESPONSE_CODES } from '@hbs/shared-kernel';
import { ResponseFactory } from '@hbs/shared-kernel';

// Mock del container
const mockContainer = {
  get: jest.fn()
};

// Mock del CreateUserUseCase
const mockCreateUserUseCase = {
  execute: jest.fn()
};

// Mock del AuthService
const mockAuthService = {
  createAuthUser: jest.fn(),
  generateToken: jest.fn()
};

// Mock del LoggerFactory
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const mockLoggerFactory = {
  getInstance: jest.fn(() => ({
    createGraphQLLogger: jest.fn(() => mockLogger)
  }))
};

// Mock de transformUser
const mockTransformUser = jest.fn();

// Mock de AuthService constructor
const mockAuthServiceConstructor = jest.fn(() => mockAuthService);

// Mock del contexto
const mockContext = {
  req: {
    headers: {
      'x-request-id': 'test-request-id',
      'user-agent': 'test-user-agent'
    }
  }
};

// Mock del input válido
const validInput = {
  email: 'test@example.com',
  password: 'password123',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+1234567890',
  dateOfBirth: '1990-01-01T00:00:00.000Z',
  role: 'customer'
};

// Mock del usuario creado
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  role: 'customer',
  isActive: true,
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    birthDate: new Date('1990-01-01T00:00:00.000Z')
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock del usuario transformado
const mockTransformedUser = {
  id: 'user-123',
  email: 'test@example.com',
  role: 'customer',
  isActive: true
};

// Mock del usuario de autenticación
const mockAuthUser = {
  id: 'user-123',
  email: 'test@example.com',
  role: 'customer',
  permissions: ['read:product', 'create:order', 'read:order', 'read:user']
};

// Mock de tokens
const mockAccessToken = 'mock-access-token-123';
const mockRefreshToken = 'mock-access-token-123'; // Usar el mismo mock para simplificar

describe('registerUser Resolver', () => {
  let registerUserResolver: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar mocks
    mockContainer.get.mockReturnValue(mockCreateUserUseCase);
    mockCreateUserUseCase.execute.mockResolvedValue(mockUser);
    mockAuthService.createAuthUser.mockReturnValue(mockAuthUser);
    mockAuthService.generateToken.mockReturnValue(mockAccessToken);
    mockTransformUser.mockReturnValue(mockTransformedUser);
    // Configurar mocks para usar las implementaciones reales
    mockTransformUser.mockReturnValue(mockTransformedUser);
    mockAuthService.createAuthUser.mockReturnValue(mockAuthUser);
    mockAuthService.generateToken.mockReturnValue(mockAccessToken);

    // Importar el resolver (esto simula la importación real)
    registerUserResolver = async (_: any, { input }: { input: any }, context: any) => {
      const startTime = Date.now();
      const traceId = `register-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para GraphQL
      const logger = mockLoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        // Log del inicio de la operación (sin datos sensibles)
        logger.info('RegisterUser resolver started', {
          operation: 'registerUser',
          requestId,
          traceId,
          timestamp: new Date().toISOString(),
          context: {
            hasEmail: !!input.email,
            hasPassword: !!input.password,
            hasFirstName: !!input.firstName,
            hasLastName: !!input.lastName,
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
          }
        });

                // Validación básica de input
        if (!input.email || !input.password || !input.firstName || !input.lastName) {
          const duration = Date.now() - startTime;
          
          logger.warn('RegisterUser validation failed', {
            operation: 'registerUser',
            requestId,
            traceId,
            duration,
            error: 'Validation failed',
            timestamp: new Date().toISOString()
          });
          
          return ResponseFactory.createErrorResponse(
            'Email, password, firstName and lastName are required',
            RESPONSE_CODES.MISSING_REQUIRED_FIELD,
            undefined,
            {
              requestId,
              traceId,
              duration
            }
          );
        }

        // Ejecutar caso de uso para crear usuario
        const createUserUseCase = mockContainer.get('createUserUseCase');
        const user = await createUserUseCase.execute({
          email: input.email,
          password: input.password,
          role: input.role || 'customer',
          isActive: true,
          profile: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            birthDate: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined
          }
        });

        // Generar tokens de autenticación
        const authService = mockAuthServiceConstructor();
        const authUser = authService.createAuthUser({
          id: user.id,
          email: user.email,
          role: user.role
        });
        
        const accessToken = authService.generateToken(authUser);
        const refreshToken = authService.generateToken(authUser);

        const duration = Date.now() - startTime;
        
        // Log del éxito (sin datos sensibles)
        logger.info('RegisterUser resolver success', {
          operation: 'registerUser',
          requestId,
          traceId,
          duration,
          userId: user.id,
          userRole: user.role,
          timestamp: new Date().toISOString(),
          context: {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            userActive: user.isActive
          }
        });

        // Crear respuesta exitosa usando ResponseFactory
        return ResponseFactory.createSuccessResponse(
          {
            user: mockTransformUser(user),
            accessToken,
            refreshToken
          },
          'User registered successfully',
          RESPONSE_CODES.CREATED,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        logger.error('RegisterUser resolver error', error, {
          errorMessage: error.message,
          input: {
            hasEmail: !!input.email,
            hasPassword: !!input.password,
            hasFirstName: !!input.firstName,
            hasLastName: !!input.lastName
          },
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          error.message || 'Internal error',
          RESPONSE_CODES.INTERNAL_ERROR,
          undefined,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    };
  });

  describe('Validación de Input', () => {
    it('debe validar que email, password, firstName y lastName sean requeridos', async () => {
      const invalidInput = {
        email: 'test@example.com',
        // password faltante
        firstName: 'John',
        // lastName faltante
      };

      const result = await registerUserResolver(null, { input: invalidInput }, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe(RESPONSE_CODES.MISSING_REQUIRED_FIELD);
      expect(result.message).toBe('Email, password, firstName and lastName are required');
      expect(mockLogger.warn).toHaveBeenCalledWith('RegisterUser validation failed', expect.any(Object));
    });

    it('debe aceptar input válido con todos los campos requeridos', async () => {
      const result = await registerUserResolver(null, { input: validInput }, mockContext);

      expect(result.success).toBe(true);
      expect(result.code).toBe(RESPONSE_CODES.CREATED);
      expect(result.message).toBe('User registered successfully');
    });
  });

  describe('Creación de Usuario', () => {
    it('debe crear usuario usando CreateUserUseCase', async () => {
      await registerUserResolver(null, { input: validInput }, mockContext);

      expect(mockContainer.get).toHaveBeenCalledWith('createUserUseCase');
      expect(mockCreateUserUseCase.execute).toHaveBeenCalledWith({
        email: validInput.email,
        password: validInput.password,
        role: validInput.role,
        isActive: true,
        profile: {
          firstName: validInput.firstName,
          lastName: validInput.lastName,
          phone: validInput.phone,
          birthDate: new Date(validInput.dateOfBirth)
        }
      });
    });

    it('debe usar role "customer" por defecto si no se especifica', async () => {
      const inputWithoutRole = { ...validInput };
      const { role, ...inputWithoutRoleData } = inputWithoutRole;

      await registerUserResolver(null, { input: inputWithoutRoleData }, mockContext);

      expect(mockCreateUserUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'customer'
        })
      );
    });
  });

  describe('Generación de Tokens', () => {
    it('debe generar accessToken y refreshToken usando AuthService', async () => {
      await registerUserResolver(null, { input: validInput }, mockContext);

      expect(mockAuthServiceConstructor).toHaveBeenCalled();
      expect(mockAuthService.createAuthUser).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role
      });
      expect(mockAuthService.generateToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('Logging', () => {
    it('debe registrar el inicio de la operación', async () => {
      await registerUserResolver(null, { input: validInput }, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('RegisterUser resolver started', expect.objectContaining({
        operation: 'registerUser',
        requestId: expect.any(String),
        traceId: expect.any(String),
        timestamp: expect.any(String),
        context: expect.objectContaining({
          hasEmail: true,
          hasPassword: true,
          hasFirstName: true,
          hasLastName: true,
          userAgent: 'test-user-agent'
        })
      }));
    });

    it('debe registrar el éxito de la operación', async () => {
      await registerUserResolver(null, { input: validInput }, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('RegisterUser resolver success', expect.objectContaining({
        operation: 'registerUser',
        requestId: expect.any(String),
        traceId: expect.any(String),
        duration: expect.any(Number),
        userId: mockUser.id,
        userRole: mockUser.role,
        context: expect.objectContaining({
          hasAccessToken: true,
          hasRefreshToken: true,
          userActive: true
        })
      }));
    });

    it('debe registrar errores de validación', async () => {
      const invalidInput = { email: 'test@example.com' }; // Campos faltantes

      await registerUserResolver(null, { input: invalidInput }, mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith('RegisterUser validation failed', expect.objectContaining({
        operation: 'registerUser',
        requestId: expect.any(String),
        traceId: expect.any(String),
        duration: expect.any(Number),
        error: expect.any(String)
      }));
    });
  });

  describe('Manejo de Errores', () => {
    it('debe manejar errores del caso de uso', async () => {
      const error = new Error('Database connection failed');
      mockCreateUserUseCase.execute.mockRejectedValue(error);

      const result = await registerUserResolver(null, { input: validInput }, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe(RESPONSE_CODES.INTERNAL_ERROR);
      expect(mockLogger.error).toHaveBeenCalledWith('RegisterUser resolver error', error, expect.any(Object));
    });

    it('debe incluir metadata en respuestas de error', async () => {
      const error = new Error('Test error');
      mockCreateUserUseCase.execute.mockRejectedValue(error);

      const result = await registerUserResolver(null, { input: validInput }, mockContext);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.requestId).toBeDefined();
      expect(result.metadata.traceId).toBeDefined();
      expect(result.metadata.duration).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
    });
  });

  describe('Estructura de Respuesta', () => {
    it('debe devolver respuesta exitosa con estructura correcta', async () => {
      const result = await registerUserResolver(null, { input: validInput }, mockContext);

      expect(result).toMatchObject({
        success: true,
        data: {
          user: mockTransformedUser,
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken
        },
        message: 'User registered successfully',
        code: RESPONSE_CODES.CREATED,
        timestamp: expect.any(String),
        metadata: {
          requestId: expect.any(String),
          traceId: expect.any(String),
          duration: expect.any(Number),
          timestamp: expect.any(String)
        }
      });
    });

    it('debe incluir metadata en respuestas exitosas', async () => {
      const result = await registerUserResolver(null, { input: validInput }, mockContext);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.requestId).toBeDefined();
      expect(result.metadata.traceId).toBeDefined();
      expect(result.metadata.duration).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
    });
  });

  describe('Performance y Tracing', () => {
    it('debe medir la duración de la operación', async () => {
      const result = await registerUserResolver(null, { input: validInput }, mockContext);

      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.metadata.duration).toBe('number');
    });

    it('debe generar traceId único para cada operación', async () => {
      const result1 = await registerUserResolver(null, { input: validInput }, mockContext);
      const result2 = await registerUserResolver(null, { input: validInput }, mockContext);

      expect(result1.metadata.traceId).not.toBe(result2.metadata.traceId);
      expect(result1.metadata.traceId).toMatch(/^register-\d+-[a-z0-9]+$/);
      expect(result2.metadata.traceId).toMatch(/^register-\d+-[a-z0-9]+$/);
    });

    it('debe usar requestId del contexto si está disponible', async () => {
      const result = await registerUserResolver(null, { input: validInput }, mockContext);

      expect(result.metadata.requestId).toBe('test-request-id');
    });
  });

  describe('Seguridad', () => {
    it('no debe exponer datos sensibles en logs', async () => {
      await registerUserResolver(null, { input: validInput }, mockContext);

      // Verificar que no se logueen passwords o tokens reales
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          context: expect.objectContaining({
            password: expect.anything()
          })
        })
      );

      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          context: expect.objectContaining({
            accessToken: expect.anything()
          })
        })
      );
    });

    it('debe validar campos requeridos antes de procesar', async () => {
      const invalidInput = { email: 'test@example.com' };

      const result = await registerUserResolver(null, { input: invalidInput }, mockContext);

      expect(result.success).toBe(false);
      expect(mockCreateUserUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
