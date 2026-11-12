/**
 * IntentLock Audit Trail System
 *
 * Implements hash-chained audit events for tamper-evident logging.
 * Each event's hash is computed from the previous hash + event data.
 */

import { createHash } from 'crypto';
import prisma from '@/lib/db';
import { AuditEventType, AuditVerification } from '@/types/audit';

interface CreateAuditEventInput {
  missionId?: string;
  eventType: AuditEventType;
  eventData: Record<string, unknown>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)])
    );
  }
  return value;
}

/**
 * Compute SHA-256 hash for an audit event
 */
function computeEventHash(
  previousHash: string | null,
  eventType: string,
  eventData: Record<string, unknown>,
  createdAt: Date
): string {
  const canonical = JSON.stringify(canonicalize({
    previousHash,
    eventType,
    eventData,
    createdAt: createdAt.toISOString(),
  }));

  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Create a new audit event with hash chaining
 */
export async function createAuditEvent(input: CreateAuditEventInput) {
  const { missionId, eventType, eventData } = input;

  return prisma.$transaction(async (transaction) => {
    const lastEvent = await transaction.auditEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { eventHash: true, createdAt: true },
    });

    const now = new Date();
    const createdAt = lastEvent && now <= lastEvent.createdAt
      ? new Date(lastEvent.createdAt.getTime() + 1)
      : now;
    const previousHash = lastEvent?.eventHash || null;
    const eventHash = computeEventHash(previousHash, eventType, eventData, createdAt);

    return transaction.auditEvent.create({
      data: {
        missionId,
        eventType,
        eventData: JSON.stringify(eventData),
        previousHash,
        eventHash,
        createdAt,
      },
    });
  });
}

/**
 * Get audit events for a specific mission
 */
export async function getMissionAuditEvents(missionId: string) {
  const events = await prisma.auditEvent.findMany({
    where: { missionId },
    orderBy: { createdAt: 'asc' },
  });

  return events.map(event => ({
    ...event,
    eventData: JSON.parse(event.eventData),
  }));
}

/**
 * Get all audit events (for verification)
 */
export async function getAllAuditEvents() {
  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: 'asc' },
  });

  return events.map(event => ({
    ...event,
    eventData: JSON.parse(event.eventData),
  }));
}

/**
 * Verify the integrity of the audit chain
 */
export async function verifyAuditChain(): Promise<AuditVerification> {
  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (events.length === 0) {
    return {
      valid: true,
      totalEvents: 0,
      verifiedEvents: 0,
      brokenAt: null,
      details: 'No events to verify',
    };
  }

  let previousHash: string | null = null;
  let verifiedCount = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventData = JSON.parse(event.eventData);

    // Verify the previous hash matches
    if (event.previousHash !== previousHash) {
      return {
        valid: false,
        totalEvents: events.length,
        verifiedEvents: verifiedCount,
        brokenAt: i,
        details: `Chain broken at event ${i}: expected previousHash "${previousHash}" but found "${event.previousHash}"`,
      };
    }

    // Recompute the hash and verify
    const computedHash = computeEventHash(
      previousHash,
      event.eventType,
      eventData,
      event.createdAt
    );

    if (computedHash !== event.eventHash) {
      return {
        valid: false,
        totalEvents: events.length,
        verifiedEvents: verifiedCount,
        brokenAt: i,
        details: `Hash mismatch at event ${i}: computed "${computedHash}" but stored "${event.eventHash}"`,
      };
    }

    previousHash = event.eventHash;
    verifiedCount++;
  }

  return {
    valid: true,
    totalEvents: events.length,
    verifiedEvents: verifiedCount,
    brokenAt: null,
    details: `All ${verifiedCount} events verified successfully`,
  };
}

/**
 * Verify audit chain for a specific mission
 */
export async function verifyMissionAuditChain(missionId: string): Promise<AuditVerification> {
  const [verification, missionEventCount] = await Promise.all([
    verifyAuditChain(),
    prisma.auditEvent.count({ where: { missionId } }),
  ]);

  if (!verification.valid) {
    return verification;
  }

  return {
    valid: true,
    totalEvents: missionEventCount,
    verifiedEvents: missionEventCount,
    brokenAt: null,
    details: `Global audit chain is valid; ${missionEventCount} mission events are included`,
  };
}

// Pre-defined audit event creators for common operations

export async function auditMissionCreated(missionId: string, prompt: string) {
  return createAuditEvent({
    missionId,
    eventType: 'mission_created',
    eventData: {
      missionId,
      promptPreview: prompt.substring(0, 100),
      timestamp: new Date().toISOString(),
    },
  });
}

export async function auditPolicyGenerated(missionId: string, policyVersion: number) {
  return createAuditEvent({
    missionId,
    eventType: 'policy_generated',
    eventData: {
      missionId,
      policyVersion,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function auditPolicyConfirmed(missionId: string, policyVersion: number) {
  return createAuditEvent({
    missionId,
    eventType: 'policy_confirmed',
    eventData: {
      missionId,
      policyVersion,
      confirmedAt: new Date().toISOString(),
    },
  });
}

export async function auditProductsRecommended(missionId: string, productIds: string[]) {
  return createAuditEvent({
    missionId,
    eventType: 'products_recommended',
    eventData: {
      missionId,
      productIds,
      count: productIds.length,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function auditOrderCreated(
  missionId: string,
  orderId: string,
  paypalOrderId: string,
  amountCents: number
) {
  return createAuditEvent({
    missionId,
    eventType: 'order_created',
    eventData: {
      missionId,
      orderId,
      paypalOrderId,
      amountCents,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function auditOrderApproved(missionId: string, paypalOrderId: string) {
  return createAuditEvent({
    missionId,
    eventType: 'order_approved',
    eventData: {
      missionId,
      paypalOrderId,
      approvedAt: new Date().toISOString(),
    },
  });
}

export async function auditOrderCaptured(
  missionId: string,
  paypalOrderId: string,
  captureId: string,
  amountCents: number
) {
  return createAuditEvent({
    missionId,
    eventType: 'order_captured',
    eventData: {
      missionId,
      paypalOrderId,
      captureId,
      amountCents,
      capturedAt: new Date().toISOString(),
    },
  });
}

export async function auditOrderBlocked(
  missionId: string,
  paypalOrderId: string,
  reason: string,
  violations: Array<{ checkName: string; explanation: string }>
) {
  return createAuditEvent({
    missionId,
    eventType: 'order_blocked',
    eventData: {
      missionId,
      paypalOrderId,
      reason,
      violations,
      blockedAt: new Date().toISOString(),
    },
  });
}

export async function auditTamperingDetected(
  missionId: string,
  paypalOrderId: string,
  tamperedField: string,
  expected: string,
  actual: string
) {
  return createAuditEvent({
    missionId,
    eventType: 'tampering_detected',
    eventData: {
      missionId,
      paypalOrderId,
      tamperedField,
      expected,
      actual,
      detectedAt: new Date().toISOString(),
      severity: 'CRITICAL',
    },
  });
}
