import pino from "pino";
import { Request, Response } from "express";
import { PaymentService } from "./payment.service";

const logger = pino({ name: "PaymentController" });

type PaymentWebhookQuery = {
  orderId: string;
  vnp_ResponseCode: string;
  vnp_SecureHash: string;
  vnp_TransactionNo?: string;
  correlationId?: string;
};

export class PaymentController {
  static async createPaymentUrl(req: Request, res: Response) {
    const userId = req.currentUser!.id;
    const { orderId, amount } = req.body;
    const correlationId =
      req.correlationId || req.header("x-correlation-id") || undefined;
    const ipAddress =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";

    logger.info(
      { correlationId, userId, orderId, amount },
      "Received request to create payment link",
    );

    const paymentUrl = await PaymentService.processCheckout(
      orderId,
      userId,
      amount,
      ipAddress as string,
      correlationId,
    );

    res.status(200).send({
      message: "Payment link created successfully",
      data: { paymentUrl },
    });
  }

  static async vnpayIpn(req: Request, res: Response) {
    const queryData = req.query as unknown as PaymentWebhookQuery;
    logger.info({ queryData }, "Received Webhook (IPN) from payment gateway");

    try {
      const result = await PaymentService.handleWebhook(queryData);

      if (result.status === "success") {
        return res
          .status(200)
          .json({ RspCode: "00", Message: "Confirm Success" });
      }

      if (result.status === "ignored") {
        return res
          .status(200)
          .json({ RspCode: "00", Message: "Webhook Already Processed" });
      }

      return res
        .status(200)
        .json({ RspCode: "00", Message: "Transaction Failed Logged" });
    } catch (error: any) {
      logger.error({ err: error.message }, "Error processing IPN Webhook");
      return res
        .status(200)
        .json({ RspCode: "97", Message: "Invalid Checksum" });
    }
  }

  static async mockIpn(req: Request, res: Response) {
    logger.info({ query: req.query }, "Running mock IPN Webhook");
    const result = await PaymentService.handleWebhook(
      req.query as unknown as PaymentWebhookQuery,
    );

    if (result.status === "ignored") {
      return res.status(200).send(`
        <html>
          <body style="text-align: center; padding: 50px; font-family: sans-serif;">
            <h1 style="color: #f59e0b;">Mock Payment Already Processed</h1>
            <p>This webhook was already handled before, so no duplicate event was emitted.</p>
          </body>
        </html>
      `);
    }

    const isSuccess = result.status === "success";

    return res.status(200).send(`
      <html>
        <body style="text-align: center; padding: 50px; font-family: sans-serif;">
          <h1 style="color: ${isSuccess ? "green" : "crimson"};">
            ${isSuccess ? "Mock Payment Successful!" : "Mock Payment Failed!"}
          </h1>
          <p>The payment webhook has been processed and the matching outbox event has been recorded.</p>
          <p>
            ${
              isSuccess
                ? "Order Service can now consume PaymentCompleted and move the order to PROCESSING."
                : "Order Service can react to PaymentFailed if that listener is added later."
            }
          </p>
        </body>
      </html>
    `);
  }
}
