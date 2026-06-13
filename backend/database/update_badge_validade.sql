-- Update all badges to have an expiration date 1-2 months from now
-- Random distribution between 30-60 days from today

UPDATE badge
SET validade = CURRENT_DATE + (FLOOR(RANDOM() * 31) + 30)::INTEGER
WHERE validade IS NULL;

-- Verify the update
SELECT nbadge, b_nome, validade, 
       validade - CURRENT_DATE AS days_until_expiration
FROM badge
ORDER BY validade ASC;
