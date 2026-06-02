import { PrismaClient } from '../../prisma';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type {
  IStoreSettingsRepository,
  StoreSettingData,
} from '../../domain/repositories/IStoreSettingsRepository';

export class PrismaStoreSettingsRepository implements IStoreSettingsRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaStoreSettingsRepository',
    );
  }

  async findAll(): Promise<StoreSettingData[]> {
    try {
      const items = await this.prisma.storeSettings.findMany({ where: { isActive: true } });
      return items.map((s) => this.mapToData(s));
    } catch (error) {
      this.logger.error(
        'Error finding all StoreSettings',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findByKey(key: string): Promise<StoreSettingData | null> {
    try {
      const s = await this.prisma.storeSettings.findUnique({ where: { settingKey: key } });
      return s ? this.mapToData(s) : null;
    } catch (error) {
      this.logger.error(
        'Error finding StoreSetting by key',
        error instanceof Error ? error : new Error(String(error)),
        { key },
      );
      throw error;
    }
  }

  private mapToData(s: any): StoreSettingData {
    return {
      id: s.id,
      settingKey: s.settingKey,
      settingValue: s.settingValue,
      description: s.description ?? null,
      category: s.category ?? null,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
}
