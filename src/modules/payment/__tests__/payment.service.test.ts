import { BadRequestError } from "@teleshop/common";
import { InboxRepository } from "../../inbox/inbox.repository";
import { PaymentRepository } from "../payment.repository";
import { PaymentService } from "../payment.service";

jest.mock("../payment.repository");
jest.mock("../../inbox/inbox.repository");

describe("PaymentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ignores duplicate webhook deliveries", async () => {
    jest.spyOn(InboxRepository, "isEventProcessed").mockResolvedValue(true);

    const result = await PaymentService.handleWebhook({
      orderId: "00000000-0000-0000-0000-000000000401",
      vnp_ResponseCode: "00",
      vnp_SecureHash: "mock_hash_123",
      vnp_TransactionNo: "MOCK-1",
    });

    expect(result).toEqual({
      status: "ignored",
      message: "Webhook already processed",
    });
    expect(PaymentRepository.completePayment).not.toHaveBeenCalled();
    expect(PaymentRepository.failPayment).not.toHaveBeenCalled();
  });

  it("rejects invalid webhook signatures", async () => {
    await expect(
      PaymentService.handleWebhook({
        orderId: "00000000-0000-0000-0000-000000000401",
        vnp_ResponseCode: "00",
        vnp_SecureHash: "invalid",
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("marks successful webhook as completed and stores inbound processing state", async () => {
    jest.spyOn(InboxRepository, "isEventProcessed").mockResolvedValue(false);
    jest
      .spyOn(PaymentRepository, "completePayment")
      .mockResolvedValue({} as never);
    jest
      .spyOn(InboxRepository, "markAsProcessed")
      .mockResolvedValue({} as never);

    const result = await PaymentService.handleWebhook({
      orderId: "00000000-0000-0000-0000-000000000401",
      vnp_ResponseCode: "00",
      vnp_SecureHash: "mock_hash_123",
      vnp_TransactionNo: "MOCK-1",
      correlationId: "corr-payment-1",
    });

    expect(result).toEqual({
      status: "success",
      message: "Payment successful",
    });
    expect(PaymentRepository.completePayment).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000401",
      "MOCK-1",
      "corr-payment-1",
    );
    expect(InboxRepository.markAsProcessed).toHaveBeenCalledWith(
      "payment-webhook:00000000-0000-0000-0000-000000000401:MOCK-1:00",
      "payment.webhook.completed",
    );
  });
});
