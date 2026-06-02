import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import { GraphQLError } from 'graphql';
import type {
  IPaymentMethodRepository,
  PaymentMethodData,
} from '../../domain/repositories/IPaymentMethodRepository';
import {
  assertOwnerOrOrderManagement,
  hasOrderManagementAccess,
} from './guards/orderAuthGuards';

export class GetUserPaymentMethodsUseCase {
  private readonly logger: ILogger;

  constructor(private readonly paymentMethodRepository: IPaymentMethodRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger(
      'GetUserPaymentMethodsUseCase',
    );
  }

  async execute(
    targetUserId: string,
    currentUser: TokenPayload | null,
  ): Promise<PaymentMethodData[]> {
    assertOwnerOrOrderManagement(currentUser, targetUserId);

    const results = await this.paymentMethodRepository.findByUserId(targetUserId);
    this.logger.info('User payment methods retrieved', {
      targetUserId,
      requesterId: currentUser!.userId,
      count: results.length,
    });
    return results;
  }
}

export class GetPaymentMethodByIdUseCase {
  private readonly logger: ILogger;

  constructor(private readonly paymentMethodRepository: IPaymentMethodRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger(
      'GetPaymentMethodByIdUseCase',
    );
  }

  /**
   * Returns the payment method if the caller is the owner or has management access.
   * Returns NotFoundError (ambiguous 404) when:
   *   - the payment method does not exist
   *   - the caller is not the owner and does not have management access
   * This prevents existence-enumeration (BOLA / CWE-639).
   */
  async execute(
    id: string,
    currentUser: TokenPayload | null,
  ): Promise<PaymentMethodData> {
    if (!currentUser) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
      });
    }

    const ownerUserId = await this.paymentMethodRepository.resolveOwnerUserId(id);

    // Ambiguous 404: conflates "not found" and "access denied" to prevent enumeration.
    if (ownerUserId === null) {
      throw new NotFoundError('PaymentMethod', id);
    }

    // Non-owner + non-management → ambiguous 404, not 403, to prevent enumeration.
    if (currentUser.userId !== ownerUserId && !hasOrderManagementAccess(currentUser)) {
      throw new NotFoundError('PaymentMethod', id);
    }

    const pm = await this.paymentMethodRepository.findById(id);
    if (!pm) {
      throw new NotFoundError('PaymentMethod', id);
    }

    this.logger.info('PaymentMethod retrieved by id', {
      paymentMethodId: id,
      requesterId: currentUser.userId,
    });
    return pm;
  }
}
