import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import { GraphQLError } from 'graphql';
import type {
  ITransactionRepository,
  TransactionData,
} from '../../domain/repositories/ITransactionRepository';
import {
  assertOwnerOrOrderManagement,
  hasOrderManagementAccess,
} from './guards/orderAuthGuards';

export class GetUserTransactionsUseCase {
  private readonly logger: ILogger;

  constructor(private readonly transactionRepository: ITransactionRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetUserTransactionsUseCase');
  }

  async execute(
    targetUserId: string,
    currentUser: TokenPayload | null,
  ): Promise<TransactionData[]> {
    assertOwnerOrOrderManagement(currentUser, targetUserId);

    const results = await this.transactionRepository.findByUserId(targetUserId);
    this.logger.info('User transactions retrieved', {
      targetUserId,
      requesterId: currentUser!.userId,
      count: results.length,
    });
    return results;
  }
}

export class GetTransactionByIdUseCase {
  private readonly logger: ILogger;

  constructor(private readonly transactionRepository: ITransactionRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetTransactionByIdUseCase');
  }

  /**
   * Returns the transaction if the caller is the owner or has management access.
   * Returns NotFoundError (ambiguous 404) when the resource does not exist or
   * the caller is not the owner and lacks management access.
   * Prevents existence-enumeration (BOLA / CWE-639).
   */
  async execute(
    id: string,
    currentUser: TokenPayload | null,
  ): Promise<TransactionData> {
    if (!currentUser) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
      });
    }

    const ownerUserId = await this.transactionRepository.resolveOwnerUserId(id);

    // Ambiguous 404: not found or denied → same response surface.
    if (ownerUserId === null) {
      throw new NotFoundError('Transaction', id);
    }

    if (currentUser.userId !== ownerUserId && !hasOrderManagementAccess(currentUser)) {
      throw new NotFoundError('Transaction', id);
    }

    const tx = await this.transactionRepository.findById(id);
    if (!tx) {
      throw new NotFoundError('Transaction', id);
    }

    this.logger.info('Transaction retrieved by id', {
      transactionId: id,
      requesterId: currentUser.userId,
    });
    return tx;
  }
}
