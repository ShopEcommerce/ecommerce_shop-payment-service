export interface IPaymentGateway {
  createPaymentUrl(
    orderId: string,
    amount: number,
    ipAddress: string,
  ): Promise<string>;

  verifyWebhookSignature(queryData: Record<string, unknown>): boolean;
}
