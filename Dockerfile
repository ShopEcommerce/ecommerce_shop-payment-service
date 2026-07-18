FROM node:22-alpine AS builder

WORKDIR /app

COPY shared/teleshop-common-1.0.4.tgz ./shared/
COPY payment-service/package*.json ./payment-service/

WORKDIR /app/payment-service
RUN npm ci

COPY payment-service/ ./
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner

WORKDIR /app/payment-service
ENV NODE_ENV=production

COPY --from=builder /app/payment-service /app/payment-service

EXPOSE 3006
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
