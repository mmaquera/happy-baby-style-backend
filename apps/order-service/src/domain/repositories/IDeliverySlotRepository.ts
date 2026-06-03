/**
 * IDeliverySlotRepository
 *
 * CRUD for DeliverySlot records. A slot defines a delivery window within a day
 * of the week (0 = Sunday … 6 = Saturday, ISO 8601 recommendation: 1 = Monday).
 * Capacity is enforced by maxOrders.
 *
 * Mutations are guarded by requireOrderManagementAccess() at the resolver layer.
 */
export interface IDeliverySlotRepository {
  create(data: CreateDeliverySlotData): Promise<DeliverySlot>;
  update(id: string, data: UpdateDeliverySlotData): Promise<DeliverySlot>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<DeliverySlot | null>;
  findAll(params?: DeliverySlotListParams): Promise<DeliverySlot[]>;
  /**
   * Returns active slots for a given day of week.
   * Used at checkout to display available delivery windows to the customer.
   */
  findByDayOfWeek(dayOfWeek: number): Promise<DeliverySlot[]>;
}

export interface DeliverySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;  // HH:mm format, e.g. "09:00"
  endTime: string;    // HH:mm format, e.g. "13:00"
  maxOrders: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeliverySlotData {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxOrders: number;
  isActive?: boolean;
}

export interface UpdateDeliverySlotData {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  maxOrders?: number;
  isActive?: boolean;
}

export interface DeliverySlotListParams {
  dayOfWeek?: number;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}
