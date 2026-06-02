export interface StoreSettingData {
  id: string;
  settingKey: string;
  settingValue: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStoreSettingsRepository {
  /**
   * Find all active store settings.
   * Only for management/admin callers — callers are responsible for the auth guard.
   */
  findAll(): Promise<StoreSettingData[]>;

  /**
   * Find a single store setting by its key.
   * Returns null when not found.
   * Only for management/admin callers — callers are responsible for the auth guard.
   */
  findByKey(key: string): Promise<StoreSettingData | null>;
}
