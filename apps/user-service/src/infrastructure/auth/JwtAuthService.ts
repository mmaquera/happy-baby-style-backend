import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { UserRole } from '../../domain/entities/User';

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'customer';
  emailVerified: boolean;
}

export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
  token: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export class JwtAuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiration: string;
  private readonly refreshTokenExpiration: string;

  constructor(private readonly userRepository: IUserRepository) {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    this.jwtExpiration = process.env.JWT_EXPIRATION || '24h';
    this.refreshTokenExpiration = process.env.REFRESH_TOKEN_EXPIRATION || '7d';

    if (this.jwtSecret === 'your-super-secret-jwt-key') {
      console.warn('⚠️  Using default JWT secret. Please set JWT_SECRET in environment variables for production!');
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    try {
      // Find user by email using the correct repository method
      const user = await this.userRepository.getUserByEmail(credentials.email);

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password using the repository method to get password hash
      const isValidPassword = await this.verifyPassword(credentials.password, user.id);
      
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Create auth user object
      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        role: user.role as 'admin' | 'customer',
        emailVerified: user.emailVerified || false
      };

      // Generate tokens
      const accessToken = this.generateAccessToken(authUser);
      const refreshToken = this.generateRefreshToken(authUser);

      return {
        accessToken,
        refreshToken,
        user: authUser
      };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Login failed');
    }
  }

  async register(data: RegisterData): Promise<AuthTokens> {
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 12);

      // Create user using the correct repository method and structure
      const user = await this.userRepository.createUser({
        email: data.email,
        password: hashedPassword,
        role: UserRole.CUSTOMER,
        profile: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: undefined,
          birthDate: undefined
        },
        isActive: true
      });

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        role: user.role as 'admin' | 'customer',
        emailVerified: user.emailVerified || false
      };

      const accessToken = this.generateAccessToken(authUser);
      const refreshToken = this.generateRefreshToken(authUser);

      return {
        accessToken,
        refreshToken,
        user: authUser
      };
    } catch (error) {
      console.error('Register error:', error);
      throw new Error('Registration failed');
    }
  }

  async validateToken(token: string): Promise<AuthUser | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Verify user still exists using the correct repository method
      const user = await this.userRepository.getUserById(decoded.id);
      if (!user) {
        return null;
      }

      return {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        emailVerified: decoded.emailVerified
      };
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as any;
      
      // Verify user still exists using the correct repository method
      const user = await this.userRepository.getUserById(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        role: user.role as 'admin' | 'customer',
        emailVerified: user.emailVerified || false
      };

      const newAccessToken = this.generateAccessToken(authUser);
      const newRefreshToken = this.generateRefreshToken(authUser);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: authUser
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      throw new Error('Token refresh failed');
    }
  }

  private generateAccessToken(user: AuthUser): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      },
      this.jwtSecret as jwt.Secret,
      { expiresIn: this.jwtExpiration } as jwt.SignOptions
    );
  }

  private generateRefreshToken(user: AuthUser): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      },
      this.jwtSecret as jwt.Secret,
      { expiresIn: this.refreshTokenExpiration } as jwt.SignOptions
    );
  }

  private async verifyPassword(password: string, userId: string): Promise<boolean> {
    try {
      // Get the actual password hash from the repository
      const passwordHash = await this.userRepository.getUserPasswordHash(userId);
      
      if (!passwordHash) {
        // Fallback to default password for demo purposes
        const defaultPassword = 'password123';
        return password === defaultPassword;
      }
      
      // Compare with the actual stored hash
      return await bcrypt.compare(password, passwordHash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  extractTokenFromAuthHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  async createAuthContext(authHeader: string | undefined): Promise<AuthContext> {
    const token = this.extractTokenFromAuthHeader(authHeader);
    
    if (!token) {
      return {
        user: null,
        isAuthenticated: false,
        token: null
      };
    }

    const user = await this.validateToken(token);
    
    return {
      user,
      isAuthenticated: !!user,
      token
    };
  }
}