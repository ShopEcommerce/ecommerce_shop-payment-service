import { z } from "zod";

export const createPaymentSchema = z.object({
  body: z.object({
    orderId: z
      .string({ error: "Missing order ID" })
      .uuid("Order ID must be a valid UUID"),
    amount: z
      .number({ error: "Missing amount" })
      .positive("Payment amount must be a positive number"),
  }),
});

export const paymentIpnSchema = z.object({
  query: z.object({
    orderId: z
      .string({ error: "Missing order ID" })
      .uuid("Order ID must be a valid UUID"),
    vnp_ResponseCode: z.string({
      error: "Missing response code from payment gateway",
    }),
    vnp_SecureHash: z.string({
      error: "Missing security hash from payment gateway",
    }),
    vnp_TransactionNo: z.string().optional(),
    correlationId: z.string().optional(),
  }),
});
