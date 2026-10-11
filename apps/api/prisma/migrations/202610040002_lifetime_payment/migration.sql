CREATE TABLE "LifetimePayment" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "referenceId" TEXT NOT NULL,
 "providerId" TEXT, "providerOrderId" TEXT, "paymentId" TEXT, "checkoutUrl" TEXT,
 "amount" INTEGER NOT NULL DEFAULT 100000, "currency" TEXT NOT NULL DEFAULT 'INR',
 "status" TEXT NOT NULL DEFAULT 'created', "expiresAt" TIMESTAMP(3) NOT NULL,
 "legacyCancelled" BOOLEAN NOT NULL DEFAULT false, "paidAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LifetimePayment_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "LifetimePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LifetimePayment_referenceId_key" ON "LifetimePayment"("referenceId");
CREATE UNIQUE INDEX "LifetimePayment_providerId_key" ON "LifetimePayment"("providerId");
CREATE UNIQUE INDEX "LifetimePayment_paymentId_key" ON "LifetimePayment"("paymentId");
CREATE INDEX "LifetimePayment_userId_createdAt_idx" ON "LifetimePayment"("userId", "createdAt");
CREATE INDEX "LifetimePayment_providerOrderId_idx" ON "LifetimePayment"("providerOrderId");
