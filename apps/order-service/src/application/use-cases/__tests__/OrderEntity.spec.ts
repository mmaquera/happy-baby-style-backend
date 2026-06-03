/**
 * Tests for OrderEntity state machine.
 *
 * Covers:
 *   - All valid transitions from the canonical table
 *   - All invalid transitions (BusinessLogicError)
 *   - canBe*() helpers derived from the same table
 *   - canBePaid() / canBeRefunded() payment-status helpers
 *   - transition() returns new immutable instance (never mutates `this`)
 *   - paymentStatus is propagated on transition
 */

import { OrderEntity, OrderStatus, PaymentStatus } from '../../../domain/entities/Order';
import { BusinessLogicError } from '@hbs/shared-kernel';

// ── Factory helper ─────────────────────────────────────────────────────────────

function makeEntity(
  status: OrderStatus = 'pending',
  paymentStatus: PaymentStatus = 'pending',
): OrderEntity {
  return new OrderEntity(
    'ord-1',
    'user-1',
    'ORD-2026-000001',
    'test@test.com',
    'Test User',
    status,
    paymentStatus,
    100,
    18,
    0,
    0,
    118,
    'PEN',
    new Date('2026-01-01'),
    new Date('2026-01-01'),
  );
}

// ── Transition table: valid transitions ────────────────────────────────────────

describe('OrderEntity — valid status transitions', () => {
  it('pending → confirmed', () => {
    const entity = makeEntity('pending');
    const next = entity.transition('confirmed');
    expect(next.status).toBe('confirmed');
  });

  it('pending → cancelled', () => {
    const entity = makeEntity('pending');
    const next = entity.transition('cancelled');
    expect(next.status).toBe('cancelled');
  });

  it('confirmed → processing', () => {
    const entity = makeEntity('confirmed');
    const next = entity.transition('processing');
    expect(next.status).toBe('processing');
  });

  it('confirmed → cancelled', () => {
    const entity = makeEntity('confirmed');
    const next = entity.transition('cancelled');
    expect(next.status).toBe('cancelled');
  });

  it('processing → shipped', () => {
    const entity = makeEntity('processing');
    const next = entity.transition('shipped');
    expect(next.status).toBe('shipped');
  });

  it('processing → cancelled', () => {
    const entity = makeEntity('processing');
    const next = entity.transition('cancelled');
    expect(next.status).toBe('cancelled');
  });

  it('shipped → delivered', () => {
    const entity = makeEntity('shipped');
    const next = entity.transition('delivered');
    expect(next.status).toBe('delivered');
    // deliveredAt should be set automatically on delivery
    expect(next.deliveredAt).toBeInstanceOf(Date);
  });

  it('delivered → refunded', () => {
    const entity = makeEntity('delivered');
    const next = entity.transition('refunded');
    expect(next.status).toBe('refunded');
  });
});

// ── Transition table: invalid transitions ─────────────────────────────────────

describe('OrderEntity — invalid status transitions', () => {
  it('pending → delivered throws BusinessLogicError', () => {
    const entity = makeEntity('pending');
    expect(() => entity.transition('delivered')).toThrow(BusinessLogicError);
  });

  it('pending → shipped throws BusinessLogicError', () => {
    const entity = makeEntity('pending');
    expect(() => entity.transition('shipped')).toThrow(BusinessLogicError);
  });

  it('delivered → cancelled throws BusinessLogicError', () => {
    const entity = makeEntity('delivered');
    expect(() => entity.transition('cancelled')).toThrow(BusinessLogicError);
  });

  it('delivered → confirmed throws BusinessLogicError', () => {
    const entity = makeEntity('delivered');
    expect(() => entity.transition('confirmed')).toThrow(BusinessLogicError);
  });

  it('cancelled → pending throws BusinessLogicError (terminal state)', () => {
    const entity = makeEntity('cancelled');
    expect(() => entity.transition('pending')).toThrow(BusinessLogicError);
  });

  it('cancelled → confirmed throws BusinessLogicError (terminal state)', () => {
    const entity = makeEntity('cancelled');
    expect(() => entity.transition('confirmed')).toThrow(BusinessLogicError);
  });

  it('refunded → pending throws BusinessLogicError (terminal state)', () => {
    const entity = makeEntity('refunded');
    expect(() => entity.transition('pending')).toThrow(BusinessLogicError);
  });

  it('error message contains from and to status', () => {
    const entity = makeEntity('pending');
    try {
      entity.transition('delivered');
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BusinessLogicError);
      expect((err as BusinessLogicError).message).toContain('pending');
      expect((err as BusinessLogicError).message).toContain('delivered');
    }
  });
});

// ── Immutability ───────────────────────────────────────────────────────────────

describe('OrderEntity — immutability', () => {
  it('transition() returns a NEW instance, does not mutate this', () => {
    const original = makeEntity('pending');
    const next = original.transition('confirmed');

    expect(original.status).toBe('pending');   // original unchanged
    expect(next.status).toBe('confirmed');      // new instance has new status
    expect(next).not.toBe(original);           // different object reference
  });

  it('paymentStatus is preserved across status transitions', () => {
    const entity = makeEntity('pending', 'paid');
    const next = entity.transition('confirmed');
    expect(next.paymentStatus).toBe('paid');
  });
});

// ── canBe*() helpers ──────────────────────────────────────────────────────────

describe('OrderEntity — canBe*() helpers', () => {
  it('canBeCancelled() — true for pending', () => {
    expect(makeEntity('pending').canBeCancelled()).toBe(true);
  });

  it('canBeCancelled() — true for confirmed', () => {
    expect(makeEntity('confirmed').canBeCancelled()).toBe(true);
  });

  it('canBeCancelled() — true for processing', () => {
    expect(makeEntity('processing').canBeCancelled()).toBe(true);
  });

  it('canBeCancelled() — false for shipped', () => {
    expect(makeEntity('shipped').canBeCancelled()).toBe(false);
  });

  it('canBeCancelled() — false for delivered', () => {
    expect(makeEntity('delivered').canBeCancelled()).toBe(false);
  });

  it('canBeCancelled() — false for cancelled (terminal)', () => {
    expect(makeEntity('cancelled').canBeCancelled()).toBe(false);
  });

  it('canBeShipped() — true for processing', () => {
    expect(makeEntity('processing').canBeShipped()).toBe(true);
  });

  it('canBeShipped() — false for confirmed (must go processing first)', () => {
    expect(makeEntity('confirmed').canBeShipped()).toBe(false);
  });

  it('canBeShipped() — false for pending', () => {
    expect(makeEntity('pending').canBeShipped()).toBe(false);
  });

  it('canBeDelivered() — true for shipped', () => {
    expect(makeEntity('shipped').canBeDelivered()).toBe(true);
  });

  it('canBeDelivered() — false for processing', () => {
    expect(makeEntity('processing').canBeDelivered()).toBe(false);
  });
});

// ── Payment-status helpers ────────────────────────────────────────────────────

describe('OrderEntity — payment-status helpers', () => {
  it('canBePaid() — true when paymentStatus is pending', () => {
    expect(makeEntity('pending', 'pending').canBePaid()).toBe(true);
  });

  it('canBePaid() — false when paymentStatus is paid', () => {
    expect(makeEntity('confirmed', 'paid').canBePaid()).toBe(false);
  });

  it('canBePaid() — false when paymentStatus is failed', () => {
    expect(makeEntity('pending', 'failed').canBePaid()).toBe(false);
  });

  it('canBeRefunded() — true when paymentStatus is paid', () => {
    expect(makeEntity('delivered', 'paid').canBeRefunded()).toBe(true);
  });

  it('canBeRefunded() — false when paymentStatus is pending', () => {
    expect(makeEntity('pending', 'pending').canBeRefunded()).toBe(false);
  });

  it('canBeRefunded() — false when paymentStatus is refunded (already refunded)', () => {
    expect(makeEntity('refunded', 'refunded').canBeRefunded()).toBe(false);
  });

  it('canBeRefunded() — false when paymentStatus is failed', () => {
    expect(makeEntity('pending', 'failed').canBeRefunded()).toBe(false);
  });
});
