import { BadRequestError } from "@teleshop/common";
import { IPaymentGateway } from "../../gateways/payment-gateway.interface";
import { MockVNPayAdapter } from "../../gateways/mock-vnpay.adapter";
import { InboxRepository } from "../inbox/inbox.repository";
import { PaymentRepository } from "./payment.repository";

type PaymentWebhookQuery = {
  orderId: string;
  vnp_ResponseCode: string;
  vnp_SecureHash: string;
  vnp_TransactionNo?: string;
  correlationId?: string;
};

export class PaymentService {
  private static gateway: IPaymentGateway = new MockVNPayAdapter();

  static async processCheckout(
    orderId: string,
    userId: string,
    amount: number,
    ipAddress: string,
    _correlationId?: string,
  ) {
    const existingPayment = await PaymentRepository.findByOrderId(orderId);

    if (existingPayment?.status === "SUCCESS") {
      throw new BadRequestError(
        "Payment has already been completed for this order",
      );
    }

    if (existingPayment) {
      await PaymentRepository.resetTransaction(
        orderId,
        userId,
        amount,
        "VNPAY_MOCK",
      );
    } else {
      await PaymentRepository.createTransaction(
        orderId,
        userId,
        amount,
        "VNPAY_MOCK",
      );
    }

    return this.gateway.createPaymentUrl(orderId, amount, ipAddress);
  }

  static async handleWebhook(queryData: PaymentWebhookQuery) {
    const isValid = this.gateway.verifyWebhookSignature(queryData);
    if (!isValid) {
      throw new BadRequestError("Invalid signature. Fraud detected!");
    }

    const orderId = queryData.orderId;
    const responseCode = queryData.vnp_ResponseCode;
    const transactionNo = queryData.vnp_TransactionNo || "MOCK_TRANS_123";
    const correlationId =
      queryData.correlationId || `payment:${orderId}:${transactionNo}`;
    const inboundEventId = `payment-webhook:${orderId}:${transactionNo}:${responseCode}`;

    if (await InboxRepository.isEventProcessed(inboundEventId)) {
      return {
        status: "ignored",
        message: "Webhook already processed",
      } as const;
    }

    if (responseCode === "00") {
      await PaymentRepository.completePayment(
        orderId,
        transactionNo,
        correlationId,
      );
      await InboxRepository.markAsProcessed(
        inboundEventId,
        "payment.webhook.completed",
      );
      return { status: "success", message: "Payment successful" } as const;
    }

    await PaymentRepository.failPayment(
      orderId,
      `VNPay response code: ${responseCode}`,
      correlationId,
    );
    await InboxRepository.markAsProcessed(
      inboundEventId,
      "payment.webhook.failed",
    );
    return { status: "failed", message: "Transaction failed" } as const;
  }
}
