-- Additive: the default online payment provider is now Cashfree. Existing rows are untouched.
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET DEFAULT 'cashfree';
ALTER TABLE "Payment" ALTER COLUMN "provider" SET DEFAULT 'cashfree';
