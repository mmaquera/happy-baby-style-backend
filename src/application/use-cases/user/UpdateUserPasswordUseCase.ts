export interface UpdateUserPasswordRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface IUserAuthRepository {
  verifyPassword(userId: string, password: string): Promise<boolean>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  getUserById(userId: string): Promise<{ id: string; email: string; isActive: boolean } | null>;
}

export class UpdateUserPasswordUseCase {
  constructor(private authRepository: IUserAuthRepository) {}

  async execute(data: UpdateUserPasswordRequest): Promise<void> {
    // Validate inputs
    if (!data.userId) {
      throw new Error('User ID is required');
    }

    if (!data.currentPassword) {
      throw new Error('Current password is required');
    }

    if (!data.newPassword) {
      throw new Error('New password is required');
    }

    if (!data.confirmPassword) {
      throw new Error('Password confirmation is required');
    }

    // Validate new password
    if (data.newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(data.newPassword);
    const hasLowerCase = /[a-z]/.test(data.newPassword);
    const hasNumbers = /\d/.test(data.newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(data.newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      throw new Error('New password must contain at least one uppercase letter, one lowercase letter, and one number');
    }

    // Check if passwords match
    if (data.newPassword !== data.confirmPassword) {
      throw new Error('New password and confirmation do not match');
    }

    // Check if new password is different from current
    if (data.currentPassword === data.newPassword) {
      throw new Error('New password must be different from current password');
    }

    // Verify user exists and is active
    const user = await this.authRepository.getUserById(data.userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('User account is deactivated');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.authRepository.verifyPassword(data.userId, data.currentPassword);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    await this.authRepository.updatePassword(data.userId, data.newPassword);
  }

  async validatePasswordStrength(password: string): Promise<{
    isValid: boolean;
    score: number; // 0-5
    feedback: string[];
  }> {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) {
      score++;
    } else {
      feedback.push('Password should be at least 8 characters long');
    }

    if (password.length >= 12) {
      score++;
    }

    // Character complexity
    if (/[A-Z]/.test(password)) {
      score++;
    } else {
      feedback.push('Add uppercase letters');
    }

    if (/[a-z]/.test(password)) {
      score++;
    } else {
      feedback.push('Add lowercase letters');
    }

    if (/\d/.test(password)) {
      score++;
    } else {
      feedback.push('Add numbers');
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score++;
    } else {
      feedback.push('Add special characters');
    }

    // Common password patterns
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i,
      /admin/i,
      /letmein/i
    ];

    const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
    if (hasCommonPattern) {
      score = Math.max(0, score - 2);
      feedback.push('Avoid common password patterns');
    }

    const isValid = score >= 4 && !hasCommonPattern;

    return {
      isValid,
      score,
      feedback
    };
  }

  async generatePasswordResetToken(email: string): Promise<string> {
    // This would integrate with Supabase Auth to send password reset email
    // For now, we'll return a mock token
    if (!email) {
      throw new Error('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // In real implementation, this would:
    // 1. Generate a secure reset token
    // 2. Store it with expiration time
    // 3. Send email with reset link
    // 4. Return success status

    return 'mock_reset_token_' + Date.now();
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    // Validate inputs
    if (!token) {
      throw new Error('Reset token is required');
    }

    if (!newPassword) {
      throw new Error('New password is required');
    }

    // Validate password strength
    const validation = await this.validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      throw new Error(`Password is too weak: ${validation.feedback.join(', ')}`);
    }

    // In real implementation, this would:
    // 1. Verify token is valid and not expired
    // 2. Get user ID from token
    // 3. Update user password
    // 4. Invalidate the reset token

    // For now, we'll simulate success
    console.log(`Password reset with token: ${token}`);
  }
}