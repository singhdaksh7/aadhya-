-- Additive: shipment milestones for the customer tracking timeline + admin pickup/sync fields.
ALTER TABLE "Shipment" ADD COLUMN "pickupStatus" TEXT, ADD COLUMN "lastSyncedAt" TIMESTAMP(3), ADD COLUMN "cancelledAt" TIMESTAMP(3);

CREATE TABLE "ShipmentEvent" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShipmentEvent_shipmentId_status_key" ON "ShipmentEvent"("shipmentId", "status");
CREATE INDEX "ShipmentEvent_orderId_idx" ON "ShipmentEvent"("orderId");
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
