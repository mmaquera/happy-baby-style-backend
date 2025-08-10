import { ValidationService, ValidationResult } from './ValidationService';

export interface UserRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: Date;
}

export interface UserProfileData {
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: Date;
  avatarUrl?: string;
}

export interface UserAddressData {
  title: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface PasswordUpdateData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export class UserValidationService extends ValidationService {
  
  /**
   * Validate user registration data
   */
  validateRegistration(data: UserRegistrationData): ValidationResult {
    const errors: string[] = [];

    // Email validation
    if (!data.email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(data.email)) {
      errors.push('Email format is invalid');
    }

    // Password validation
    const passwordValidation = this.validatePassword(data.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }

    // Name validation
    if (!data.firstName || data.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }

    // Name format validation
    if (data.firstName && !this.isValidName(data.firstName)) {
      errors.push('First name contains invalid characters');
    }

    if (data.lastName && !this.isValidName(data.lastName)) {
      errors.push('Last name contains invalid characters');
    }

    // Phone validation (optional)
    if (data.phone && !this.isValidPhone(data.phone)) {
      errors.push('Phone number format is invalid');
    }

    // Birth date validation (optional)
    if (data.birthDate && !this.isValidBirthDate(data.birthDate)) {
      errors.push('Birth date is invalid');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate user profile update data
   */
  validateProfileUpdate(data: UserProfileData): ValidationResult {
    const errors: string[] = [];

    // Name validation
    if (!data.firstName || data.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }

    // Name format validation
    if (data.firstName && !this.isValidName(data.firstName)) {
      errors.push('First name contains invalid characters');
    }

    if (data.lastName && !this.isValidName(data.lastName)) {
      errors.push('Last name contains invalid characters');
    }

    // Phone validation (optional)
    if (data.phone && !this.isValidPhone(data.phone)) {
      errors.push('Phone number format is invalid');
    }

    // Birth date validation (optional)
    if (data.birthDate && !this.isValidBirthDate(data.birthDate)) {
      errors.push('Birth date is invalid');
    }

    // Avatar URL validation (optional)
    if (data.avatarUrl && !this.isValidUrl(data.avatarUrl)) {
      errors.push('Avatar URL format is invalid');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate user address data
   */
  validateAddress(data: UserAddressData): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!data.title || data.title.trim().length < 2) {
      errors.push('Address title must be at least 2 characters long');
    }

    if (!data.firstName || data.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }

    if (!data.addressLine1 || data.addressLine1.trim().length < 5) {
      errors.push('Address line 1 must be at least 5 characters long');
    }

    if (!data.city || data.city.trim().length < 2) {
      errors.push('City must be at least 2 characters long');
    }

    if (!data.state || data.state.trim().length < 2) {
      errors.push('State must be at least 2 characters long');
    }

    if (!data.postalCode || !this.isValidPostalCode(data.postalCode)) {
      errors.push('Postal code format is invalid');
    }

    // Name format validation
    if (data.firstName && !this.isValidName(data.firstName)) {
      errors.push('First name contains invalid characters');
    }

    if (data.lastName && !this.isValidName(data.lastName)) {
      errors.push('Last name contains invalid characters');
    }

    // Address format validation
    if (data.addressLine1 && !this.isValidAddress(data.addressLine1)) {
      errors.push('Address line 1 contains invalid characters');
    }

    if (data.addressLine2 && !this.isValidAddress(data.addressLine2)) {
      errors.push('Address line 2 contains invalid characters');
    }

    if (data.city && !this.isValidCityName(data.city)) {
      errors.push('City name contains invalid characters');
    }

    if (data.state && !this.isValidCityName(data.state)) {
      errors.push('State name contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate password update data
   */
  validatePasswordUpdate(data: PasswordUpdateData): ValidationResult {
    const errors: string[] = [];

    // Current password required
    if (!data.currentPassword) {
      errors.push('Current password is required');
    }

    // New password validation
    const passwordValidation = this.validatePassword(data.newPassword);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }

    // Confirm password validation
    if (!data.confirmPassword) {
      errors.push('Password confirmation is required');
    } else if (data.newPassword !== data.confirmPassword) {
      errors.push('New password and confirmation do not match');
    }

    // Check if new password is different from current
    if (data.currentPassword === data.newPassword) {
      errors.push('New password must be different from current password');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate login credentials
   */
  validateLogin(email: string, password: string): ValidationResult {
    const errors: string[] = [];

    if (!email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(email)) {
      errors.push('Email format is invalid');
    }

    if (!password) {
      errors.push('Password is required');
    } else if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate user search query
   */
  validateSearchQuery(query: string): ValidationResult {
    const errors: string[] = [];

    if (!query || query.trim().length < 2) {
      errors.push('Search query must be at least 2 characters long');
    }

    if (query && query.length > 100) {
      errors.push('Search query must be less than 100 characters');
    }

    // Check for potentially malicious content
    if (query && this.containsSuspiciousContent(query)) {
      errors.push('Search query contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ==================== PRIVATE VALIDATION METHODS ====================

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  private validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

    // Character complexity requirements
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', 'password123', '123456', 'qwerty', 'abc123',
      'admin', 'letmein', 'welcome', 'monkey', 'dragon'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidName(name: string): boolean {
    // Allow letters, spaces, hyphens, apostrophes
    const nameRegex = /^[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ\s\-']+$/;
    return nameRegex.test(name) && name.length <= 50;
  }

  private isValidPhone(phone: string): boolean {
    // Allow various phone formats (international and local)
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    return phoneRegex.test(cleanPhone) && cleanPhone.length >= 8 && cleanPhone.length <= 15;
  }

  private isValidBirthDate(birthDate: Date): boolean {
    const now = new Date();
    const minAge = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
    const maxAge = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
    
    return birthDate >= minAge && birthDate <= maxAge;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidPostalCode(postalCode: string): boolean {
    // Support various postal code formats
    const postalRegex = /^[0-9A-Za-z\s\-]{3,10}$/;
    return postalRegex.test(postalCode);
  }

  private isValidAddress(address: string): boolean {
    // Allow letters, numbers, spaces, common punctuation
    const addressRegex = /^[a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ\s\.\,\-\#\/]+$/;
    return addressRegex.test(address) && address.length <= 200;
  }

  private isValidCityName(city: string): boolean {
    // Allow letters, spaces, hyphens, apostrophes
    const cityRegex = /^[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ\s\-'\.]+$/;
    return cityRegex.test(city) && city.length <= 100;
  }

  private containsSuspiciousContent(content: string): boolean {
    // Check for SQL injection, XSS, etc.
    const suspiciousPatterns = [
      /script/i,
      /javascript/i,
      /vbscript/i,
      /onload/i,
      /onerror/i,
      /select.*from/i,
      /union.*select/i,
      /drop.*table/i,
      /insert.*into/i,
      /delete.*from/i,
      /<[^>]*>/,
      /eval\(/i,
      /expression\(/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }
}