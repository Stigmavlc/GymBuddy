-- Create pending_sessions table for two-user coordination
CREATE TABLE IF NOT EXISTS pending_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time INTEGER NOT NULL CHECK (start_time >= 0 AND start_time < 24),
  end_time INTEGER NOT NULL CHECK (end_time > start_time AND end_time <= 28),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'counter_proposed', 'expired')),
  proposer_confirmed BOOLEAN DEFAULT true,
  partner_confirmed BOOLEAN DEFAULT false,
  counter_proposal JSONB, -- Stores alternative time suggestions
  message TEXT, -- Optional message with the proposal
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_pending_sessions_proposed_by ON pending_sessions(proposed_by);
CREATE INDEX idx_pending_sessions_proposed_to ON pending_sessions(proposed_to);
CREATE INDEX idx_pending_sessions_status ON pending_sessions(status);
CREATE INDEX idx_pending_sessions_expires_at ON pending_sessions(expires_at);

-- Enable RLS
ALTER TABLE pending_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own pending sessions" ON pending_sessions
  FOR SELECT USING (auth.uid() = proposed_by OR auth.uid() = proposed_to);

CREATE POLICY "Users can create pending sessions" ON pending_sessions
  FOR INSERT WITH CHECK (auth.uid() = proposed_by);

CREATE POLICY "Users can update pending sessions they're involved in" ON pending_sessions
  FOR UPDATE USING (auth.uid() = proposed_by OR auth.uid() = proposed_to);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at
CREATE TRIGGER update_pending_sessions_updated_at BEFORE UPDATE ON pending_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired pending sessions
CREATE OR REPLACE FUNCTION cleanup_expired_pending_sessions()
RETURNS void AS $$
BEGIN
    UPDATE pending_sessions 
    SET status = 'expired' 
    WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;