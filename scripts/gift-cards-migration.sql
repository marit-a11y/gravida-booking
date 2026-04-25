CREATE TABLE IF NOT EXISTS gift_cards (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'digitaal',
  value_euros DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'wacht_op_betaling',
  purchaser_name VARCHAR(255) NOT NULL,
  purchaser_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  personal_message TEXT,
  mollie_payment_id VARCHAR(100),
  redeemed_at TIMESTAMPTZ,
  redeemed_by_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gift_cards_code_idx ON gift_cards(code);
CREATE INDEX IF NOT EXISTS gift_cards_status_idx ON gift_cards(status);
CREATE INDEX IF NOT EXISTS gift_cards_purchaser_email_idx ON gift_cards(purchaser_email);
