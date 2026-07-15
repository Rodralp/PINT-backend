CREATE TABLE IF NOT EXISTS pedido_historico (
  nhistorico SERIAL PRIMARY KEY,
  npedido INTEGER NOT NULL REFERENCES pedidos(npedido) ON DELETE CASCADE,
  nestado INTEGER NOT NULL REFERENCES estado(nestado),
  nutilizador INTEGER REFERENCES utilizador(nutilizador),
  data_estado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  descricao VARCHAR(280)
);

CREATE INDEX IF NOT EXISTS idx_pedido_historico_npedido ON pedido_historico(npedido);
CREATE INDEX IF NOT EXISTS idx_pedido_historico_data_estado ON pedido_historico(data_estado);
