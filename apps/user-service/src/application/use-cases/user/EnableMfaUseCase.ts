import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ILogger } from '@hbs/logging';
import { NotFoundError, BusinessLogicError } from '../../../domain/errors/DomainError';
import { encryptMfaSecret } from '@hbs/auth';
import { generateSecret, generateURI } from 'otplib';
import QRCode from 'qrcode';

const APP_NAME = 'HappyBabyStyle';

export interface EnableMfaRequest {
  userId: string;
}

export interface EnableMfaResponse {
  otpauthUrl: string;
  qrDataUrl: string;
  secret: string; // plain-text — returned to client ONCE; never logged
}

export class EnableMfaUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(data: EnableMfaRequest): Promise<EnableMfaResponse> {
    // G-11: userId must be provided (caller is always authenticated)
    this.logger.info('Initiating MFA setup', { userId: data.userId });

    const user = await this.userRepository.getUserById(data.userId);
    if (!user) {
      throw new NotFoundError('User', data.userId);
    }

    const mfaData = await this.userRepository.getMfaData(data.userId);
    if (mfaData?.mfaEnabled) {
      throw new BusinessLogicError('MFA is already enabled for this account');
    }

    // Generate a new TOTP secret (32-char Base32)
    const plainSecret = generateSecret();

    // Build otpauth URL using otplib 13.x functional API
    // `type` field is omitted (defaults to totp in the library)
    const otpauthUrl = generateURI({
      label: user.email,
      issuer: APP_NAME,
      secret: plainSecret,
    });

    // Generate QR code data URL
    let qrDataUrl: string;
    try {
      qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    } catch (qrErr) {
      this.logger.error('Failed to generate MFA QR code', qrErr as Error, {
        userId: data.userId,
      });
      throw new BusinessLogicError('Failed to generate QR code for MFA setup');
    }

    // G-4: encrypt before persisting; G-3: never log the secret
    const encryptedSecret = encryptMfaSecret(plainSecret);
    await this.userRepository.setMfaSecret(data.userId, encryptedSecret);

    this.logger.info('MFA setup initiated — secret stored (pending confirmation)', {
      userId: data.userId,
      // G-3: DO NOT log otpauthUrl, plainSecret, or qrDataUrl
    });

    return {
      otpauthUrl,
      qrDataUrl,
      secret: plainSecret, // returned ONCE to client; never persisted or logged again
    };
  }
}
