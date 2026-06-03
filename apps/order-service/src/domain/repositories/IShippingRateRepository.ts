/**
 * IShippingRateRepository
 *
 * CRUD for ShippingRate records. Each rate belongs to a ShippingZone (zoneId FK)
 * and defines a price band optionally constrained by min/max weight.
 *
 * Mutations are guarded by requireOrderManagementAccess() at the resolver layer.
 */
export interface IShippingRateRepository {
  create(data: CreateShippingRateData): Promise<ShippingRate>;
  update(id: string, data: UpdateShippingRateData): Promise<ShippingRate>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<ShippingRate | null>;
  findAll(params?: ShippingRateListParams): Promise<ShippingRate[]>;
  /**
   * Returns all active rates for a given zone. Used by order checkout to
   * determine applicable shipping options for a given address.
   */
  findByZoneId(zoneId: string): Promise<ShippingRate[]>;
}

export interface ShippingRate {
  id: string;
  zoneId: string;
  name: string;
  minWeight: string | null;  // Decimal serialized as string to avoid float precision loss
  maxWeight: string | null;
  price: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShippingRateData {
  zoneId: string;
  name: string;
  minWeight?: string;
  maxWeight?: string;
  price: string;
  isActive?: boolean;
}

export interface UpdateShippingRateData {
  name?: string;
  minWeight?: string | null;
  maxWeight?: string | null;
  price?: string;
  isActive?: boolean;
}

export interface ShippingRateListParams {
  zoneId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}
