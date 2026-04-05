-- Insert sample API cost data for testing
-- Data spans last 30 days with various categories

-- Recent costs (this week)
INSERT INTO api_cost_log (timestamp, cost_usd, category, project, model, tokens_input, tokens_output, endpoint) VALUES
  (NOW() - INTERVAL '1 day', 0.45, 'llm', 'IRIS', 'claude-sonnet-4', 5000, 1200, '/api/chat'),
  (NOW() - INTERVAL '1 day', 0.32, 'llm', 'IRIS', 'gpt-4', 3200, 800, '/api/completion'),
  (NOW() - INTERVAL '2 days', 0.28, 'vision', 'IRIS', 'gpt-4-vision', 1500, 300, '/api/analyze-image'),
  (NOW() - INTERVAL '2 days', 0.15, 'tts', NULL, 'eleven-labs', NULL, NULL, '/api/tts'),
  (NOW() - INTERVAL '3 days', 0.52, 'llm', 'IRIS', 'claude-sonnet-4', 6500, 1500, '/api/chat'),
  (NOW() - INTERVAL '3 days', 0.38, 'llm', 'dashboard', 'gpt-4', 4200, 950, '/api/completion'),
  (NOW() - INTERVAL '4 days', 0.41, 'llm', 'IRIS', 'claude-sonnet-4', 5100, 1300, '/api/chat'),
  (NOW() - INTERVAL '5 days', 0.22, 'embedding', 'search', 'text-embedding-3', 8000, NULL, '/api/embed'),
  (NOW() - INTERVAL '6 days', 0.36, 'llm', 'IRIS', 'gpt-4', 3800, 900, '/api/completion');

-- Last week
INSERT INTO api_cost_log (timestamp, cost_usd, category, project, model, tokens_input, tokens_output, endpoint) VALUES
  (NOW() - INTERVAL '8 days', 0.29, 'llm', 'IRIS', 'claude-sonnet-4', 3500, 850, '/api/chat'),
  (NOW() - INTERVAL '9 days', 0.18, 'vision', 'IRIS', 'gpt-4-vision', 1200, 250, '/api/analyze-image'),
  (NOW() - INTERVAL '10 days', 0.33, 'llm', 'dashboard', 'gpt-4', 3900, 920, '/api/completion'),
  (NOW() - INTERVAL '11 days', 0.24, 'llm', 'IRIS', 'claude-sonnet-4', 2800, 700, '/api/chat'),
  (NOW() - INTERVAL '12 days', 0.19, 'tts', NULL, 'eleven-labs', NULL, NULL, '/api/tts'),
  (NOW() - INTERVAL '13 days', 0.31, 'llm', 'IRIS', 'gpt-4', 3700, 880, '/api/completion'),
  (NOW() - INTERVAL '14 days', 0.27, 'llm', 'IRIS', 'claude-sonnet-4', 3200, 800, '/api/chat');

-- Older data (2-4 weeks ago)
INSERT INTO api_cost_log (timestamp, cost_usd, category, project, model, tokens_input, tokens_output, endpoint) VALUES
  (NOW() - INTERVAL '16 days', 0.35, 'llm', 'IRIS', 'claude-sonnet-4', 4200, 1100, '/api/chat'),
  (NOW() - INTERVAL '18 days', 0.26, 'llm', 'dashboard', 'gpt-4', 3100, 750, '/api/completion'),
  (NOW() - INTERVAL '20 days', 0.21, 'vision', 'IRIS', 'gpt-4-vision', 1400, 280, '/api/analyze-image'),
  (NOW() - INTERVAL '22 days', 0.30, 'llm', 'IRIS', 'claude-sonnet-4', 3600, 900, '/api/chat'),
  (NOW() - INTERVAL '24 days', 0.17, 'embedding', 'search', 'text-embedding-3', 7000, NULL, '/api/embed'),
  (NOW() - INTERVAL '26 days', 0.34, 'llm', 'IRIS', 'gpt-4', 3850, 925, '/api/completion'),
  (NOW() - INTERVAL '28 days', 0.23, 'llm', 'IRIS', 'claude-sonnet-4', 2700, 680, '/api/chat');
