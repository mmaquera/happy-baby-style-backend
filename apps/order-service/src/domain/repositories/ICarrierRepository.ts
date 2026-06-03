/**
 * ICarrierRepository
 *
 * CRUD for Carrier records (shipping carriers / couriers).
 * Carriers are referenced by OrderTracking via carrierId (cross-service UUID ref).
 * This is a config-admin repository: mutations are guarded by
 * requireOrderManagementAccess() at the resolver layer.
 */
export interface ICarrierRepository {
  create(data: CreateCarrierData): Promise<Carrier>;
  update(id: string, data: UpdateCarrierData): Promise<Carrier>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<Carrier | null>;
  /**
   * Returns all carriers. Callers MUST apply a reasonable limit at the
   * resolver layer; this list is admin-facing and expected to be small.
   */
  findAll(params?: CarrierListParams): Promise<Carrier[]>;
}

export interface Carrier {
  id: string;
  name: string;
  code: string;
  trackingUrlTemplate: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCarrierData {
  name: string;
  code: string;
  trackingUrlTemplate?: string;
  isActive?: boolean;
}

export interface UpdateCarrierData {
  name?: string;
  code?: string;
  trackingUrlTemplate?: string | null;
  isActive?: boolean;
}

export interface CarrierListParams {
  isActive?: boolean;
  limit?: number;
  offset?: number;
}
