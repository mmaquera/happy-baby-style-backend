import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type {
  IStoreSettingsRepository,
  StoreSettingData,
} from '../../domain/repositories/IStoreSettingsRepository';
import { assertOrderManagementAccess } from './guards/orderAuthGuards';

export class GetStoreSettingsUseCase {
  private readonly logger: ILogger;

  constructor(private readonly storeSettingsRepository: IStoreSettingsRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetStoreSettingsUseCase');
  }

  /**
   * Returns all active store settings.
   * Restricted to management/admin — settings contain sensitive store configuration.
   */
  async execute(currentUser: TokenPayload | null): Promise<StoreSettingData[]> {
    assertOrderManagementAccess(currentUser);

    const results = await this.storeSettingsRepository.findAll();
    this.logger.info('Store settings retrieved', {
      requesterId: currentUser!.userId,
      count: results.length,
    });
    return results;
  }
}

export class GetStoreSettingByKeyUseCase {
  private readonly logger: ILogger;

  constructor(private readonly storeSettingsRepository: IStoreSettingsRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetStoreSettingByKeyUseCase');
  }

  /**
   * Returns a store setting by its key.
   * Restricted to management/admin.
   * Returns null when not found.
   */
  async execute(key: string, currentUser: TokenPayload | null): Promise<StoreSettingData | null> {
    assertOrderManagementAccess(currentUser);

    const setting = await this.storeSettingsRepository.findByKey(key);
    this.logger.info('StoreSetting retrieved by key', {
      key,
      requesterId: currentUser!.userId,
      found: setting !== null,
    });
    return setting;
  }
}
