import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User } from '../../../domain/entities/User';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export interface AuthenticateUserRequest {
  email: string;
  password: string;
}

export interface AuthenticateUserResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export class AuthenticateUserUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(data: AuthenticateUserRequest): Promise<AuthenticateUserResponse> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password
    if (!data.password || data.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Check if user exists
    const user = await this.userRepository.getUserByEmail(data.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('User account is deactivated');
    }

    // Verify password hash
    const storedPassword = await this.userRepository.getUserPasswordHash(user.id);
    if (!storedPassword) {
      throw new Error('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(data.password, storedPassword);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        type: 'refresh'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Update last login time
    await this.userRepository.updateUserLastLogin(user.id);
    
    return {
      user,
      accessToken,
      refreshToken
    };
  }
}