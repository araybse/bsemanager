-- Fix column name mismatch: rename to standard input_tokens/output_tokens
ALTER TABLE api_cost_log 
  RENAME COLUMN tokens_input TO input_tokens;

ALTER TABLE api_cost_log 
  RENAME COLUMN tokens_output TO output_tokens;

-- Add comment explaining the fix
COMMENT ON COLUMN api_cost_log.input_tokens IS 'Input tokens used (renamed from tokens_input)';
COMMENT ON COLUMN api_cost_log.output_tokens IS 'Output tokens used (renamed from tokens_output)';
