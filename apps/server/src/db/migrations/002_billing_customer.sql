ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_customer text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS environment text;
CREATE INDEX IF NOT EXISTS subscriptions_customer_idx ON subscriptions (provider, provider_customer);
