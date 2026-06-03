/**
 * IShippingZoneRepository
 *
 * CRUD for ShippingZone records. A zone defines the geographic scope
 * (countries, states, cities, postal codes) for which a set of ShippingRates apply.
 *
 * Mutations are guarded by requireOrderManagementAccess() at the resolver layer.
 * ShippingRates are managed via IShippingRateRepository using zoneId.
 */
export interface IShippingZoneRepository {
  create(data: CreateShippingZoneData): Promise<ShippingZone>;
  update(id: string, data: UpdateShippingZoneData): Promise<ShippingZone>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<ShippingZone | null>;
  findAll(params?: ShippingZoneListParams): Promise<ShippingZone[]>;
}

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  states: string[];
  cities: string[];
  postalCodes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShippingZoneData {
  name: string;
  countries?: string[];
  states?: string[];
  cities?: string[];
  postalCodes?: string[];
  isActive?: boolean;
}

export interface UpdateShippingZoneData {
  name?: string;
  countries?: string[];
  states?: string[];
  cities?: string[];
  postalCodes?: string[];
  isActive?: boolean;
}

export interface ShippingZoneListParams {
  isActive?: boolean;
  limit?: number;
  offset?: number;
}
