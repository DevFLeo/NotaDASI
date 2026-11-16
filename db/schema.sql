-- ============================================================================
-- Schema PostgreSQL para o NotaDASI — Diagnóstico de Adesão ao SIG
-- Prefeitura Municipal de Porto Velho (RO)
-- ============================================================================
--
-- ARQUITETURA DE IMPLANTAÇÃO MUNICIPAL (SEM BANCO EXCLUSIVO):
-- Em servidores municipais compartilhados, não é necessário (nem recomendado)
-- criar um novo banco de dados (database). O sistema opera 100% isolado
-- dentro do seu próprio SCHEMA:
--
--   CREATE SCHEMA IF NOT EXISTS notadasi;
--   SET search_path TO notadasi, public;
--
-- PROXY REVERSO E SUB-CAMINHOS DE URL:
-- Quando o NotaDASI rodar como dependência dentro de outro portal ou URL
-- (ex.: https://sig.portovelho.ro.gov.br/notadasi/ ou embutido via iframe),
-- a variável BASE_PATH=/notadasi/ garante o roteamento correto de assets e APIs.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS notadasi;
SET search_path TO notadasi, public;

-- 1. TABELA PRINCIPAL DE COMPETÊNCIAS / REGISTROS
-- Gerenciada prioritariamente pelo perfil DASI.
CREATE TABLE IF NOT EXISTS notadasi.registros (
    id                              TEXT PRIMARY KEY,

    -- Lotação
    departamento                    TEXT NOT NULL,
    departamento_sigla              TEXT NOT NULL,
    departamento_responsavel        TEXT NOT NULL,
    departamento_cargo              TEXT NOT NULL,
    setor                           TEXT NOT NULL,
    setor_sigla                     TEXT NOT NULL,
    responsavel                     TEXT NOT NULL,
    cargo                           TEXT NOT NULL,

    -- Competência avaliada
    competencia                     TEXT NOT NULL,

    -- Atendimento pelo SIG (NULL = não respondido / "-", igual ao app)
    sistema_atende                  BOOLEAN,
    como_atende                     TEXT NOT NULL DEFAULT '',
    estruturado_no_sistema          BOOLEAN,
    houve_treinamento               BOOLEAN,

    -- Camadas
    informacoes_acessadas           TEXT NOT NULL DEFAULT '',
    nivel_acesso_camada             TEXT NOT NULL DEFAULT '',
    acesso_camada_concedido         BOOLEAN,
    iniciou_atividade               BOOLEAN,

    -- Módulo
    modulo_sig                      TEXT NOT NULL DEFAULT '',
    nivel_acesso_modulo             TEXT NOT NULL DEFAULT '',
    acesso_modulo_concedido         BOOLEAN,

    -- Problemas
    tem_problema                    BOOLEAN,
    tem_chamado                     BOOLEAN,
    detalhe_problema                TEXT NOT NULL DEFAULT '',
    observacao                      TEXT NOT NULL DEFAULT '',

    -- Contatos
    contato_institucional_email     TEXT,
    contato_institucional_telefone  TEXT,
    contato_institucional_ramal     TEXT,
    contato_pessoal_email           TEXT,
    contato_pessoal_telefone        TEXT,

    favorito                        BOOLEAN NOT NULL DEFAULT false,

    -- Metadados de Autoria (DASI como trabalhador prioritário)
    criado_por_usuario              TEXT NOT NULL DEFAULT 'DASI',
    criado_por_nome                 TEXT NOT NULL DEFAULT 'DASI',
    criado_por_papel                TEXT NOT NULL DEFAULT 'dasi',
    atualizado_por_usuario          TEXT,
    atualizado_por_nome             TEXT,
    atualizado_por_papel            TEXT,

    criado_em                       TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registros_setor_sigla ON notadasi.registros (setor_sigla);
CREATE INDEX IF NOT EXISTS idx_registros_departamento_sigla ON notadasi.registros (departamento_sigla);

-- 2. TABELA DE AUDITORIA COMPULSÓRIA (Ações do DASI e Administradores)
-- Toda inserção, alteração ou exclusão feita nas tabelas principais gera um log imutável.
CREATE TABLE IF NOT EXISTS notadasi.auditoria_registros (
    id                  BIGSERIAL PRIMARY KEY,
    registro_id         TEXT NOT NULL,
    usuario             TEXT NOT NULL,
    nome                TEXT NOT NULL,
    papel               TEXT NOT NULL,
    acao                TEXT NOT NULL, -- 'CRIACAO', 'EDICAO', 'EXCLUSAO'
    detalhes            TEXT NOT NULL,
    campos_alterados    JSONB,
    dados_anteriores    JSONB,
    dados_novos         JSONB,
    data_hora           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_registro_id ON notadasi.auditoria_registros (registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_data_hora ON notadasi.auditoria_registros (data_hora DESC);

-- 3. TABELA DE COMENTÁRIOS E PARECERES TÉCNICOS
-- Regra de Negócio: Chefe do DGEO e Secretaria declaram comentários/despachos para o DASI.
CREATE TABLE IF NOT EXISTS notadasi.comentarios_registros (
    id                  TEXT PRIMARY KEY,
    registro_id         TEXT NOT NULL REFERENCES notadasi.registros(id) ON DELETE CASCADE,
    usuario             TEXT NOT NULL,
    nome                TEXT NOT NULL,
    papel               TEXT NOT NULL, -- 'gerente', 'secretario', 'dasi'
    destinatario        TEXT NOT NULL DEFAULT 'todos', -- 'dasi', 'gerente', 'secretario', 'todos'
    texto               TEXT NOT NULL,
    data_hora           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comentarios_registro ON notadasi.comentarios_registros (registro_id, data_hora ASC);

-- 4. TABELA DE ANOTAÇÕES DE USO PESSOAL (Secretaria)
-- Regra de Negócio: Secretaria pode criar notas de uso pessoal / minutas privativas
CREATE TABLE IF NOT EXISTS notadasi.notas_pessoais (
    id                  BIGSERIAL PRIMARY KEY,
    usuario_id          TEXT NOT NULL,
    registro_id         TEXT NOT NULL REFERENCES notadasi.registros(id) ON DELETE CASCADE,
    texto               TEXT NOT NULL,
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, registro_id)
);

-- 5. TABELA DE AMBIENTES / COFRES (Campos livres criados pelo Chefe do DGEO ou DASI)
CREATE TABLE IF NOT EXISTS notadasi.ambientes (
    id                  TEXT PRIMARY KEY,
    nome                TEXT NOT NULL,
    tipo                TEXT NOT NULL DEFAULT 'livre',
    criado_por_usuario  TEXT NOT NULL,
    criado_por_papel    TEXT NOT NULL,
    formulario          JSONB NOT NULL,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para manter atualizado_em atualizado automaticamente
CREATE OR REPLACE FUNCTION notadasi.atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registros_atualizado_em ON notadasi.registros;
CREATE TRIGGER trg_registros_atualizado_em
    BEFORE UPDATE ON notadasi.registros
    FOR EACH ROW
    EXECUTE FUNCTION notadasi.atualizar_timestamp();

-- Trigger de auditoria automática em updates
CREATE OR REPLACE FUNCTION notadasi.gravar_auditoria()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO notadasi.auditoria_registros (
            registro_id,
            usuario,
            nome,
            papel,
            acao,
            detalhes,
            dados_anteriores,
            dados_novos
        ) VALUES (
            NEW.id,
            COALESCE(NEW.atualizado_por_usuario, 'DASI'),
            COALESCE(NEW.atualizado_por_nome, 'DASI'),
            COALESCE(NEW.atualizado_por_papel, 'dasi'),
            'EDICAO',
            'Registro atualizado no sistema',
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO notadasi.auditoria_registros (
            registro_id,
            usuario,
            nome,
            papel,
            acao,
            detalhes,
            dados_novos
        ) VALUES (
            NEW.id,
            COALESCE(NEW.criado_por_usuario, 'DASI'),
            COALESCE(NEW.criado_por_nome, 'DASI'),
            COALESCE(NEW.criado_por_papel, 'dasi'),
            'CRIACAO',
            'Novo registro criado no sistema',
            to_jsonb(NEW)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registros_auditoria ON notadasi.registros;
CREATE TRIGGER trg_registros_auditoria
    AFTER INSERT OR UPDATE ON notadasi.registros
    FOR EACH ROW
    EXECUTE FUNCTION notadasi.gravar_auditoria();
