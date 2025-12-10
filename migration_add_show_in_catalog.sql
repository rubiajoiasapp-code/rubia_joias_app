-- Add show_in_catalog column to produtos table
-- Default to FALSE for new products, but we will set existing ones to TRUE

ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS show_in_catalog BOOLEAN DEFAULT FALSE;

-- Update existing products to show in catalog by default (migration strategy)
UPDATE produtos 
SET show_in_catalog = TRUE 
WHERE show_in_catalog IS NULL;

-- Make it not null after population if desired, or just leave as is with default
ALTER TABLE produtos 
ALTER COLUMN show_in_catalog SET DEFAULT FALSE;
