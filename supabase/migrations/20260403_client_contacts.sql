-- Client Contacts Table
-- Associates contacts (people) with clients (companies)

CREATE TABLE IF NOT EXISTS client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  title VARCHAR(255),
  notes TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast client lookups
CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON client_contacts(client_id);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_client_contacts_email ON client_contacts(email);

-- RLS Policies
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all contacts
CREATE POLICY "Authenticated users can view client_contacts"
  ON client_contacts
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert contacts
CREATE POLICY "Authenticated users can insert client_contacts"
  ON client_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update contacts
CREATE POLICY "Authenticated users can update client_contacts"
  ON client_contacts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete contacts
CREATE POLICY "Authenticated users can delete client_contacts"
  ON client_contacts
  FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE client_contacts IS 'Individual contacts (people) associated with client companies';
COMMENT ON COLUMN client_contacts.client_id IS 'Reference to the client company';
COMMENT ON COLUMN client_contacts.is_primary IS 'Designates the primary contact for this client';
