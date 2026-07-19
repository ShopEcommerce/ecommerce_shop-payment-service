import crypto from "crypto";
import { Subjects } from "@teleshop/common";
import { prisma } from "../../../db/prisma";
import { PaymentRepository } from "../payment.repository";

describe("PaymentRepository", () => {
  beforeEach(async () => {
    await prisma.outboxEvent.deleteMany({});
    await prisma.processedEvent.deleteMany({});
    await prisma.paymentTransaction.deleteMany({});
  });

  it("creates a completed payment and writes a shared-compliant PaymentCompleted outbox event", async () => {
    const orderId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    await PaymentRepository.createTransaction(
      orderId,
      "00000000-0000-0000-0000-000000000003",
      1250000,
      "VNPAY_MOCK",
    );

    const payment = await PaymentRepository.completePayment(
      orderId,
      "MOCK-TRANS-1",
      correlationId,
    );

    expect(payment.status).toBe("SUCCESS");
    expect(payment.providerTransactionId).toBe("MOCK-TRANS-1");

    const outboxEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: { subject: Subjects.PaymentCompleted },
    });

    const payload = outboxEvent.payload as {
      id: string;
      type: string;
      occurredAt: string;
      version: number;
      correlationId?: string;
      orderId: string;
      paymentId?: string;
      amount?: number;
    };

    expect(payload.id).toBeTruthy();
    expect(payload.type).toBe(Subjects.PaymentCompleted);
    expect(payload.version).toBe(1);
    expect(payload.correlationId).toBe(correlationId);
    expect(payload.orderId).toBe(orderId);
    expect(payload.paymentId).toBe(payment.id);
    expect(payload.amount).toBe(1250000);
  });

  it("marks a payment as failed and writes a shared-compliant PaymentFailed outbox event", async () => {
    const orderId = crypto.randomUUID();

    await PaymentRepository.createTransaction(
      orderId,
      "00000000-0000-0000-0000-000000000003",
      200000,
      "VNPAY_MOCK",
    );

    const payment = await PaymentRepository.failPayment(
      orderId,
      "VNPay response code: 24",
      "corr-failed-1",
    );

    expect(payment.status).toBe("FAILED");

    const outboxEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: { subject: Subjects.PaymentFailed },
    });

    const payload = outboxEvent.payload as {
      id: string;
      type: string;
      occurredAt: string;
      version: number;
      correlationId?: string;
      orderId: string;
      paymentId?: string;
      amount?: number;
      reason: string;
    };

    expect(payload.id).toBeTruthy();
    expect(payload.type).toBe(Subjects.PaymentFailed);
    expect(payload.version).toBe(1);
    expect(payload.correlationId).toBe("corr-failed-1");
    expect(payload.orderId).toBe(orderId);
    expect(payload.paymentId).toBe(payment.id);
    expect(payload.amount).toBe(200000);
    expect(payload.reason).toBe("VNPay response code: 24");
  });

  it("resets an existing non-successful payment transaction back to pending", async () => {
    const orderId = crypto.randomUUID();

    await PaymentRepository.createTransaction(
      orderId,
      "00000000-0000-0000-0000-000000000003",
      300000,
      "VNPAY_MOCK",
    );
    await PaymentRepository.failPayment(orderId, "VNPay response code: 24");

    const resetPayment = await PaymentRepository.resetTransaction(
      orderId,
      "00000000-0000-0000-0000-000000000004",
      450000,
      "VNPAY_MOCK",
    );

    expect(resetPayment.status).toBe("PENDING");
    expect(Number(resetPayment.amount)).toBe(450000);
    expect(resetPayment.userId).toBe("00000000-0000-0000-0000-000000000004");
    expect(resetPayment.providerTransactionId).toBeNull();
  });
});
