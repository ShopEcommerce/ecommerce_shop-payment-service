import express, { RequestHandler } from "express";
import { PaymentController } from "./payment.controller";
import { requireAuth, asyncHandler } from "@teleshop/common";
import { validateZod } from "../../middlewares/validate.middleware";
import { createPaymentSchema, paymentIpnSchema } from "./payment.schema";

const router = express.Router();
const requireAuthMw = requireAuth as unknown as RequestHandler;

// PUBLIC ROUTES

router.get(
  "/vnpay-ipn",
  validateZod(paymentIpnSchema),
  asyncHandler(PaymentController.vnpayIpn as any),
);

router.get(
  "/mock-ipn",
  validateZod(paymentIpnSchema),
  asyncHandler(PaymentController.mockIpn as any),
);

// PROTECTED ROUTES

router.use(requireAuthMw);

router.post(
  "/create-url",
  validateZod(createPaymentSchema),
  asyncHandler(PaymentController.createPaymentUrl as any),
);

export { router as paymentRouter };
