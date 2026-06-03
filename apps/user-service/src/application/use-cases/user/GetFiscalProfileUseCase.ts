import { LoggerFactory } from '@hbs/logging';
import { NotFoundError } from '@domain/errors/DomainError';
import { IUserFiscalProfileRepository } from '@domain/repositories/IUserFiscalProfileRepository';
import { UserFiscalProfile } from '@domain/entities/UserFiscalProfile';

export class GetFiscalProfileUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger('GetFiscalProfileUseCase');

  constructor(private readonly fiscalProfileRepository: IUserFiscalProfileRepository) {}

  async execute(userId: string): Promise<UserFiscalProfile> {
    this.logger.info('Fetching fiscal profile', { userId });

    const profile = await this.fiscalProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('UserFiscalProfile', userId);
    }

    this.logger.info('Fiscal profile retrieved', { userId, profileId: profile.id });
    return profile;
  }
}
