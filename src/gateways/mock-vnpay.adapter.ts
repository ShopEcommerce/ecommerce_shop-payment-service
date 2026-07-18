import { IPaymentGateway } from "./payment-gateway.interface";

export class MockVNPayAdapter implements IPaymentGateway {
  async createPaymentUrl(
    orderId: string,
    amount: number,
    ipAddress: string,
  ): Promise<string> {
    const baseUrl =
      process.env.PAYMENT_PUBLIC_BASE_URL ||
      `http://localhost:${process.env.PORT || 3006}`;
    const query = new URLSearchParams({
      orderId,
      amount: String(amount),
      ipAddress,
      vnp_ResponseCode: "00",
      vnp_TransactionNo: `MOCK-${orderId}`,
      vnp_SecureHash: "mock_hash_123",
    });

    return `${baseUrl}/api/payments/mock-ipn?${query.toString()}`;
  }

  verifyWebhookSignature(queryData: Record<string, unknown>): boolean {
    return queryData.vnp_SecureHash === "mock_hash_123";
  }
}
