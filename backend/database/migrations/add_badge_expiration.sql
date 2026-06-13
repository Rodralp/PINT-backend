-- Migration: Badge Expiration System
-- Adds expiration tracking and notification support

-- Table to track which badge expirations have been processed
CREATE TABLE IF NOT EXISTS badge_expiracao_log (
    nlog_expiracao INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge) ON DELETE CASCADE,
    data_expiracao DATE NOT NULL,
    data_processamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pedidos_rejeitados INTEGER DEFAULT 0,
    nivel_desativado BOOLEAN DEFAULT FALSE,
    CONSTRAINT unique_badge_expiracao UNIQUE (nbadge, data_expiracao)
);

-- Function to check and expire badges (called on-demand)
CREATE OR REPLACE FUNCTION fn_check_expire_badges()
RETURNS TABLE (
    badge_id INTEGER,
    badge_name VARCHAR(25),
    was_processed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.nbadge,
        b.b_nome,
        EXISTS(
            SELECT 1 FROM badge_expiracao_log bel
            WHERE bel.nbadge = b.nbadge
              AND bel.data_expiracao = b.validade
        ) AS was_processed
    FROM badge AS b
    WHERE b.validade IS NOT NULL
      AND b.validade <= CURRENT_DATE
      AND NOT EXISTS(
          SELECT 1 FROM badge_expiracao_log bel
          WHERE bel.nbadge = b.nbadge
            AND bel.data_expiracao = b.validade
      );
END;
$$ LANGUAGE plpgsql;
