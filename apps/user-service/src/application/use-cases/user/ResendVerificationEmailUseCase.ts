import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IEmailService } from '../../../domain/interfaces/IEmailService';
import { ISecurityEventRepository } from '../../../domain/repositories/ISecurityEventRepository';
import { ILogger } from '@hbs/logging';
import { RequestEmailVerificationUseCase } from './RequestEmailVerificationUseCase';

export interface ResendVerificationEmailRequest {
  email: string;
}

export interface ResendVerificationEmailResponse {
  email: string;
  timestamp: string;
}

/**
 * ResendVerificationEmailUseCase delegates entirely to RequestEmailVerificationUseCase.
 * Extracted as a separate use case to maintain a clean mutation interface and allow
 * independent rate-limiting policies in the future.
 */
export class ResendVerificationEmailUseCase {
  private readonly delegate: RequestEmailVerificationUseCase;

  constructor(
    userRepository: IUserRepository,
    emailService: IEmailService,
    securityEventRepository: ISecurityEventRepository,
    logger: ILogger,
  ) {
    this.delegate = new RequestEmailVerificationUseCase(
      userRepository,
      emailService,
      securityEventRepository,
      logger,
    );
  }

  async execute(data: ResendVerificationEmailRequest): Promise<ResendVerificationEmailResponse> {
    return this.delegate.execute({ email: data.email });
  }
}
