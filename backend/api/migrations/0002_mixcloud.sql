-- Archive episodes can live on Mixcloud instead of our own storage
-- (docs/backend-proposal/decisions/002-archive-and-licensing.md, option 1).
-- For provider 'mixcloud', object_key holds the Mixcloud cloudcast key ("/wjrh/show-name/").
ALTER TABLE episodes ADD COLUMN provider TEXT NOT NULL DEFAULT 'storage' CHECK (provider IN ('storage', 'mixcloud'));
