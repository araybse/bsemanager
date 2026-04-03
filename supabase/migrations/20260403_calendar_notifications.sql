-- Calendar Notifications Table
-- Stores MS365 calendar webhook notifications for Max to process

CREATE TABLE IF NOT EXISTS calendar_notifications (
  id BIGSERIAL PRIMARY KEY,
  change_type TEXT NOT NULL, -- created, updated, deleted
  event_id TEXT,
  notification_data JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying of unprocessed notifications
CREATE INDEX idx_calendar_notifications_unprocessed 
  ON calendar_notifications(processed, received_at) 
  WHERE processed = false;

-- Index for event lookup
CREATE INDEX idx_calendar_notifications_event_id 
  ON calendar_notifications(event_id);

COMMENT ON TABLE calendar_notifications IS 'MS365 calendar webhook notifications for real-time calendar awareness';
