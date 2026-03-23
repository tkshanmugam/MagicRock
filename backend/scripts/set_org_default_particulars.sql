-- Run this to set default particulars for your organisations if they weren't set by the migration.
-- Replace org names and values as needed. Run: psql -d your_db -f set_org_default_particulars.sql

-- By name (case-insensitive, partial match):
UPDATE organisations SET default_particulars = 'Coconut''s husk' WHERE LOWER(TRIM(name)) LIKE '%amman%';
UPDATE organisations SET default_particulars = 'Coconuts' WHERE LOWER(TRIM(name)) LIKE '%jaswanth%' OR LOWER(TRIM(name)) LIKE '%jaswant%';
UPDATE organisations SET default_particulars = 'Coconut''s Shell' WHERE LOWER(TRIM(name)) LIKE '%kumaran%';

-- Or by exact ID (replace 1, 2, 3 with your org IDs):
-- UPDATE organisations SET default_particulars = 'Coconut''s husk' WHERE id = 1;
-- UPDATE organisations SET default_particulars = 'Coconuts' WHERE id = 2;
-- UPDATE organisations SET default_particulars = 'Coconut''s Shell' WHERE id = 3;
