-- ============================================================
-- SCRIPT DE CRIACAO DO BANCO DE DADOS - SISTEMA DE BADGES
-- PostgreSQL version (converted from SQL Server syntax)
-- ============================================================

-- ============================================================
-- 1. TABELAS LP, SL, Area, Nivel, Tipo, Badge
-- ============================================================

CREATE TABLE IF NOT EXISTS learning_path (
    nlpath INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lpath VARCHAR(25) NOT NULL,
    lp_desc VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE learning_path
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS service_line (
    nsline INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sline VARCHAR(25) NOT NULL,
    sl_desc VARCHAR(255) NOT NULL,
    imagem TEXT,
    nlpath INTEGER NOT NULL REFERENCES learning_path(nlpath),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE service_line
    ADD COLUMN IF NOT EXISTS imagem TEXT;

ALTER TABLE service_line
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS area (
    narea INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    area VARCHAR(25) NOT NULL,
    a_desc VARCHAR(255) NOT NULL,
    nsline INTEGER NOT NULL REFERENCES service_line(nsline),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE area
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS tipo (
    ntipo INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS badge (
    nbadge INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    b_nome VARCHAR(25),
    b_descricao VARCHAR(255) NOT NULL,
    validade DATE,
    pontos INTEGER DEFAULT 0,
    imagem TEXT,
    ntipo INTEGER NOT NULL REFERENCES tipo(ntipo)
);

ALTER TABLE badge
    ADD COLUMN IF NOT EXISTS imagem TEXT;

CREATE TABLE IF NOT EXISTS badge_imagem (
    nbadge INTEGER PRIMARY KEY REFERENCES badge(nbadge) ON DELETE CASCADE,
    mime_type VARCHAR(50) NOT NULL DEFAULT 'image/png',
    dados BYTEA NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS b_pertence_a (
    narea INTEGER NOT NULL REFERENCES area(narea),
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge),
    PRIMARY KEY (narea, nbadge)
);

CREATE TABLE IF NOT EXISTS b_pertence_sl (
    nsline INTEGER NOT NULL REFERENCES service_line(nsline),
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge),
    PRIMARY KEY (nsline, nbadge)
);

CREATE TABLE IF NOT EXISTS b_pertence_lp (
    nlpath INTEGER NOT NULL REFERENCES learning_path(nlpath),
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge),
    PRIMARY KEY (nlpath, nbadge)
);

CREATE TABLE IF NOT EXISTS nivel (
    nnivel INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nivel VARCHAR(100) NOT NULL UNIQUE,
    narea INTEGER REFERENCES area(narea),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE nivel
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS nivel_contem_b (
    nnivel INTEGER NOT NULL REFERENCES nivel(nnivel),
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge),
    PRIMARY KEY (nnivel, nbadge)
);

-- ============================================================
-- 2. TABELAS DE UTILIZADOR
-- ============================================================

CREATE TABLE IF NOT EXISTS utilizador (
    nutilizador INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'pendente',
    data_registo DATE NOT NULL DEFAULT CURRENT_DATE,
    permissoes VARCHAR(100) NOT NULL DEFAULT 'consultor'
);

CREATE TABLE IF NOT EXISTS sll_leader_sl (
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    nsline INTEGER NOT NULL REFERENCES service_line(nsline),
    PRIMARY KEY (nutilizador, nsline)
);

-- ============================================================
-- 3. TABELAS DE PEDIDOS
-- ============================================================

CREATE TABLE IF NOT EXISTS estado (
    nestado INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estado VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS pedidos (
    npedido INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge),
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    estado INTEGER REFERENCES estado(nestado),
    data_submissao DATE NOT NULL,
    data_limite DATE,
    descricao VARCHAR(255)
);

-- ============================================================
-- 3.5. TABELAS RELACIONADAS A PEDIDOS
-- ============================================================

CREATE TABLE IF NOT EXISTS motivo (
    npedido INTEGER NOT NULL REFERENCES pedidos(npedido),
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    motivo_desc VARCHAR(280),
    PRIMARY KEY (nutilizador, npedido)
);

CREATE TABLE IF NOT EXISTS requisitos (
    nreq INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    requisito VARCHAR(50) NOT NULL,
    r_descricao VARCHAR(255) NOT NULL,
    imagem TEXT,
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge)
);

ALTER TABLE requisitos
    ADD COLUMN IF NOT EXISTS imagem TEXT;

CREATE TABLE IF NOT EXISTS badge_trigger (
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge) ON DELETE CASCADE,
    trigger_tipo VARCHAR(50) NOT NULL,
    trigger_valor INTEGER NOT NULL CHECK (trigger_valor > 0),
    PRIMARY KEY (nbadge, trigger_tipo)
);

CREATE TABLE IF NOT EXISTS sll_gere_p (
    ser_nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    npedido INTEGER NOT NULL REFERENCES pedidos(npedido),
    PRIMARY KEY (ser_nutilizador, npedido)
);

CREATE TABLE IF NOT EXISTS adm_gere_p (
    adm_nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    npedido INTEGER NOT NULL REFERENCES pedidos(npedido),
    PRIMARY KEY (adm_nutilizador, npedido)
);

CREATE TABLE IF NOT EXISTS tm_gere_p (
    tm_nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    npedido INTEGER NOT NULL REFERENCES pedidos(npedido),
    PRIMARY KEY (tm_nutilizador, npedido)
);

CREATE TABLE IF NOT EXISTS evidencias (
    nevidencias INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nevidencia VARCHAR(50),
    e_data_submissao DATE NOT NULL,
    formato VARCHAR(50),
    nreq INTEGER REFERENCES requisitos(nreq),
    npedido INTEGER REFERENCES pedidos(npedido)
);

-- ============================================================
-- 4. TABELAS DE EQUIPA
-- ============================================================

CREATE TABLE IF NOT EXISTS equipa (
    nequipa INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    equipa VARCHAR(50),
    sla VARCHAR(200),
    sla_expiracao DATE
);

CREATE TABLE IF NOT EXISTS u_pertence_equipa (
    nequipa INTEGER NOT NULL REFERENCES equipa(nequipa),
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    PRIMARY KEY (nequipa, nutilizador)
);

-- ============================================================
-- 5. TABELAS DE LOGS E NOTIFICACOES
-- ============================================================

CREATE TABLE IF NOT EXISTS logs (
        nlog INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
        data_log DATE NOT NULL DEFAULT CURRENT_DATE,
        tipo_log VARCHAR(100),
        titulo VARCHAR(200),
        mensagem TEXT,
        resumo VARCHAR(255),
        prioridade INTEGER DEFAULT 2
);

CREATE TABLE IF NOT EXISTS ficheiro_log (
        nflog INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        nlog INTEGER NOT NULL REFERENCES logs(nlog) ON DELETE CASCADE,
        nome_original VARCHAR(255) NOT NULL,
        nome_armazenado VARCHAR(255) NOT NULL,
        tipo VARCHAR(100),
        tamanho INTEGER,
        caminho VARCHAR(255),
        data_upload TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ficheiro_log_nlog ON ficheiro_log(nlog);

CREATE TABLE IF NOT EXISTS notificacao (
        nnotificacao INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
        nlog INTEGER REFERENCES logs(nlog),
        lida BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- 6. TABELA DE LEMBRETES
-- ============================================================

CREATE TABLE IF NOT EXISTS lembrete (
    nlembrete INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT NOT NULL,
    data_lembrete DATE NOT NULL,
    cor VARCHAR(30) NOT NULL,
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador)
);

-- ============================================================
-- 7. TABELA DE PREFERENCIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS preferencias (
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    narea INTEGER NOT NULL REFERENCES area(narea),
    PRIMARY KEY (narea, nutilizador)
);

-- ============================================================
-- 8. TABELAS DE CONFIGURACAO GERAL
-- ============================================================

CREATE TABLE IF NOT EXISTS config_notificacao (
    nconfig INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evento VARCHAR(150) NOT NULL UNIQUE,
    admin BOOLEAN NOT NULL DEFAULT FALSE,
    sll BOOLEAN NOT NULL DEFAULT FALSE,
    tl BOOLEAN NOT NULL DEFAULT FALSE,
    consultor BOOLEAN NOT NULL DEFAULT FALSE,
    email BOOLEAN NOT NULL DEFAULT FALSE,
    web_app BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS rgpd_topico (
    nrgpd INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    corpo TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS config_geral (
    nconfig INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chave VARCHAR(150) NOT NULL UNIQUE,
    valor VARCHAR(150) NOT NULL,
    opcoes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);

CREATE TABLE IF NOT EXISTS config_notificacao_utilizador (
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador) ON DELETE CASCADE,
    chave VARCHAR(80) NOT NULL,
    valor BOOLEAN NOT NULL,
    PRIMARY KEY (nutilizador, chave)
);

-- ============================================================
-- 9. TABELAS DE GESTAO
-- ============================================================

CREATE TABLE IF NOT EXISTS a_gere_n (
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    nnivel INTEGER NOT NULL REFERENCES nivel(nnivel),
    PRIMARY KEY (nutilizador, nnivel)
);

CREATE TABLE IF NOT EXISTS a_gere_area (
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    narea INTEGER NOT NULL REFERENCES area(narea),
    PRIMARY KEY (nutilizador, narea)
);

CREATE TABLE IF NOT EXISTS a_gere_serv (
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    nsline INTEGER NOT NULL REFERENCES service_line(nsline),
    PRIMARY KEY (nutilizador, nsline)
);

CREATE TABLE IF NOT EXISTS a_gere_lp (
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    nlpath INTEGER NOT NULL REFERENCES learning_path(nlpath),
    PRIMARY KEY (nutilizador, nlpath)
);

CREATE TABLE IF NOT EXISTS a_gere_b (
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge),
    PRIMARY KEY (nutilizador, nbadge)
);

CREATE TABLE IF NOT EXISTS a_gere_u (
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    adm_nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    PRIMARY KEY (nutilizador, adm_nutilizador)
);

CREATE TABLE IF NOT EXISTS c_obtem_b (
    nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador),
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge),
    npedido INTEGER NOT NULL REFERENCES pedidos(npedido),
    pontos_obtidos INTEGER DEFAULT 0,
    data_obtencao DATE NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (nutilizador, nbadge)
);

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
