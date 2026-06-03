/**
 * ITaxRateRepository
 *
 * CRUD for TaxRate records. Tax rates are matched by geographic scope
 * (country, state, city) at checkout time to compute taxAmount on the order.
 *
 * Note: Prisma models rate as Decimal(5,4) — values like 0.1800 represent 18%.
 * The domain layer exposes rate as a string to avoid float precision loss.
 * The implementation is responsible for Decimal ↔ string conversion.
 *
 * Mutations are guarded by requireOrderManagementAccess() at the resolver layer.
 */
export interface ITaxRateRepository {
  create(data: CreateTaxRateData): Promise<TaxRate>;
  update(id: string, data: UpdateTaxRateData): Promise<TaxRate>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<TaxRate | null>;
  findAll(params?: TaxRateListParams): Promise<TaxRate[]>;
  /**
   * Returns the first active rate that matches the given geographic scope.
   * Matching priority (most-specific first): city > state > country > fallback.
   * Returns null if no active rate matches.
   * Used by order checkout to calculate taxAmount.
   */
  findMatchingRate(country: string, state?: string, city?: string): Promise<TaxRate | null>;
}

export interface TaxRate {
  id: string;
  name: string;
  rate: string;        // Decimal string, e.g. "0.1800" for 18% IGV
  country: string | null;
  state: string | null;
  city: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaxRateData {
  name: string;
  rate: string;
  country?: string;
  state?: string;
  city?: string;
  isActive?: boolean;
}

export interface UpdateTaxRateData {
  name?: string;
  rate?: string;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  isActive?: boolean;
}

export interface TaxRateListParams {
  country?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}
