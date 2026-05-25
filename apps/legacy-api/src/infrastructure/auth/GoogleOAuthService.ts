import axios from 'axios';
import jwt from 'jsonwebtoken';
import { 
  GoogleAuthRequest, 
  GoogleUserInfo, 
  AuthTokens,
  JWTPayload,
  AuthProvider
} from '@domain/entities/Auth';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleOAuthService {
  private readonly config: GoogleOAuthConfig;
  private readonly jwtSecret: string;

  constructor() {
    this.config = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
    };

    this.jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

    if (!this.config.clientId || !this.config.clientSecret) {
      console.warn('Google OAuth credentials not properly configured');
    }
  }

  /**
   * Generate Google OAuth authorization URL
   */
  getAuthUrl(state?: string): string {
    const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state })
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    id_token?: string;
  }> {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Google token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Get user information from Google using access token
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Google user info error:', error.response?.data || error.message);
      throw new Error('Failed to fetch user information from Google');
    }
  }

  /**
   * Complete Google OAuth flow
   */
  async authenticateWithCode(authRequest: GoogleAuthRequest): Promise<{
    googleUser: GoogleUserInfo;
    tokens: {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      id_token?: string;
    };
  }> {
    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(authRequest.code);
    
    // Get user information
    const googleUser = await this.getUserInfo(tokens.access_token);

    return {
      googleUser,
      tokens
    };
  }

  /**
   * Generate JWT tokens for authenticated user
   */
  generateJWTTokens(userId: string, email: string, role: string, sessionId: string): AuthTokens {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600; // 1 hour
    const refreshExpiresIn = 30 * 24 * 3600; // 30 days

    const payload: JWTPayload = {
      sub: userId,
      email,
      role,
      provider: AuthProvider.GOOGLE,
      sessionId,
      iat: now,
      exp: now + expiresIn
    };

    const refreshPayload = {
      sub: userId,
      sessionId,
      type: 'refresh',
      iat: now,
      exp: now + refreshExpiresIn
    };

    const accessToken = jwt.sign(payload, this.jwtSecret);
    const refreshToken = jwt.sign(refreshPayload, this.jwtSecret);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer'
    };
  }

  /**
   * Verify and decode JWT token
   */
  verifyJWTToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as any;
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Generate new tokens (you'd typically fetch user info from DB here)
      return this.generateJWTTokens(
        decoded.sub,
        decoded.email || '',
        decoded.role || 'customer',
        decoded.sessionId
      );
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Validate Google ID token (if provided)
   */
  async validateIdToken(idToken: string): Promise<any> {
    try {
      // In production, you should verify the ID token properly
      // This is a simplified version
      const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      
      if (response.data.aud !== this.config.clientId) {
        throw new Error('Invalid audience');
      }

      return response.data;
    } catch (error) {
      throw new Error('Invalid ID token');
    }
  }

  /**
   * Generate state parameter for CSRF protection
   */
  generateState(): string {
    return jwt.sign(
      { timestamp: Date.now() },
      process.env.OAUTH_STATE_SECRET || 'default_state_secret',
      { expiresIn: '10m' }
    );
  }

  /**
   * Verify state parameter
   */
  verifyState(state: string): boolean {
    try {
      jwt.verify(state, process.env.OAUTH_STATE_SECRET || 'default_state_secret');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke Google tokens
   */
  async revokeTokens(token: string): Promise<void> {
    try {
      await axios.post(`https://oauth2.googleapis.com/revoke?token=${token}`);
    } catch (error) {
      console.error('Error revoking Google tokens:', error);
      // Don't throw error as this is not critical
    }
  }
}