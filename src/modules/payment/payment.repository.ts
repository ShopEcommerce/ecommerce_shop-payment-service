import crypto from "crypto";
import { PaymentStatus } from "@prisma/client";
import { DomainEvent, Subjects } from "@teleshop/common";
import { prisma } from "../../db/prisma";

type PaymentCompletedEventData = Extract<
  DomainEvent,
  { subject: Subjects.PaymentCompleted }
>["data"];
type PaymentFailedEventData = Extract<
  DomainEvent,
  { subject: Subjects.PaymentFailed }
>["data"];

export class PaymentRepository {
  static async findByOrderId(orderId: string) {
    return prisma.paymentTransaction.findUnique({
      where: { orderId },
    });
  }

  static async createTransaction(
    orderId: string,
    userId: string,
    amount: number,
    provider: string,
  ) {
    return prisma.paymentTransaction.create({
      data: {
        orderId,
        userId,
        amount,
        provider,
        status: PaymentStatus.PENDING,
      },
    });
  }

  static async resetTransaction(
    orderId: string,
    userId: string,
    amount: number,
    provider: string,
  ) {
    return prisma.paymentTransaction.update({
      where: { orderId },
      data: {
        userId,
        amount,
        provider,
        status: PaymentStatus.PENDING,
        providerTransactionId: null,
      },
    });
  }

  static async completePayment(
    orderId: string,
    providerTransactionId: string,
    correlationId?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const existingPayment = await tx.paymentTransaction.findUnique({
        where: { orderId },
      });

      if (!existingPayment) {
        throw new Error("Payment transaction not found");
      }

      if (existingPayment.status === PaymentStatus.SUCCESS) {
        return existingPayment;
      }

      const payment = await tx.paymentTransaction.update({
        where: { orderId },
        data: {
          status: PaymentStatus.SUCCESS,
          providerTransactionId,
        },
      });

      const payload: PaymentCompletedEventData = {
        id: crypto.randomUUID(),
        type: Subjects.PaymentCompleted,
        occurredAt: new Date().toISOString(),
        version: 1,
        correlationId,
        orderId: payment.orderId,
        paymentId: payment.id,
        amount: Number(payment.amount),
      };

      await tx.outboxEvent.create({
        data: {
          subject: Subjects.PaymentCompleted,
          payload: payload as any,
        },
      });

      return payment;
    });
  }

  static async failPayment(
    orderId: string,
    reason: string,
    correlationId?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const existingPayment = await tx.paymentTransaction.findUnique({
        where: { orderId },
      });

      if (!existingPayment) {
        throw new Error("Payment transaction not found");
      }

      if (existingPayment.status === PaymentStatus.FAILED) {
        return existingPayment;
      }

      const payment = await tx.paymentTransaction.update({
        where: { orderId },
        data: { status: PaymentStatus.FAILED },
      });

      const payload: PaymentFailedEventData = {
        id: crypto.randomUUID(),
        type: Subjects.PaymentFailed,
        occurredAt: new Date().toISOString(),
        version: 1,
        correlationId,
        orderId: payment.orderId,
        paymentId: payment.id,
        amount: Number(payment.amount),
        reason,
      };

      await tx.outboxEvent.create({
        data: {
          subject: Subjects.PaymentFailed,
          payload: payload as any,
        },
      });

      return payment;
    });
  }
}
