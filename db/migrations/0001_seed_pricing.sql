-- Placeholder prices for the default model (USD per million tokens).
-- verified = false until the owner saves the row from Settings.
INSERT INTO "model_pricing" ("model_id", "input_per_mtok", "output_per_mtok", "cache_read_per_mtok", "verified")
VALUES ('claude-sonnet-5-5', 3.0000, 15.0000, 0.3000, false)
ON CONFLICT ("model_id") DO NOTHING;
