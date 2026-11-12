-- CreateTable
CREATE TABLE "DemoWorkspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Demo User',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShoppingMission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "originalPrompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "ShoppingMission_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "DemoWorkspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PermissionPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "policyJson" TEXT NOT NULL,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PermissionPolicy_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "ShoppingMission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "condition" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "shippingCents" INTEGER NOT NULL,
    "taxEstimateCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "deliveryDate" DATETIME NOT NULL,
    "merchantId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "attributesJson" TEXT NOT NULL,
    "hasSubscription" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionInfo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShoppingRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "aiRank" INTEGER NOT NULL,
    "aiExplanation" TEXT NOT NULL,
    "policyDecision" TEXT NOT NULL,
    "evaluationJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShoppingRecommendation_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "ShoppingMission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShoppingRecommendation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayPalOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "paypalOrderId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "purchaseSnapshotJson" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "captureId" TEXT,
    "captureStatus" TEXT,
    "buyerApprovedAt" DATETIME,
    "capturedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayPalOrder_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "ShoppingMission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayPalOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventData" TEXT NOT NULL,
    "previousHash" TEXT,
    "eventHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "ShoppingMission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT,
    "taskType" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputJson" TEXT,
    "outputJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIExecution_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "ShoppingMission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissionPolicy_missionId_version_key" ON "PermissionPolicy"("missionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalOrder_paypalOrderId_key" ON "PayPalOrder"("paypalOrderId");
