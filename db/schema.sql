-- Schema Postgres para o NotaDASI — Diagnóstico de Adesão ao SIG.
--
-- Hoje o app roda 100% local (AsyncStorage, ver src/data/repositorio/local.ts).
-- Este arquivo prepara o formato para quando os dados forem migrados para um
-- servidor Postgres externo: é a mesma forma dos campos de `Registro`
-- (src/data/registros.ts), em snake_case (convenção SQL) em vez de camelCase.
--
-- NÃO é executado automaticamente por nada neste projeto — é só a planta
-- para o backend que vai ficar na frente deste banco. Quando esse serviço
-- existir, rode manualmente contra o Postgres de destino:
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- O app React Native nunca fala direto com o Postgres (não é seguro nem
-- viável a partir de um celular) — ele fala com uma API HTTP que fica na
-- frente deste banco. Ver src/data/repositorio/remoto.ts para o contrato
-- que essa API precisa cumprir.

CREATE TABLE IF NOT EXISTS registros (
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

    -- Contatos (achatados a partir do tipo Contato em src/data/registros.ts)
    contato_institucional_email     TEXT,
    contato_institucional_telefone  TEXT,
    contato_institucional_ramal     TEXT,
    contato_pessoal_email           TEXT,
    contato_pessoal_telefone        TEXT,

    -- Estado local do app hoje (favoritar). Enquanto não houver
    -- autenticação/múltiplos usuários, uma coluna aqui é suficiente. Se o
    -- backend ganhar login, mova para uma tabela `favoritos (usuario_id,
    -- registro_id)` em vez de coluna — um favorito passa a ser por pessoa,
    -- não por registro.
    favorito                        BOOLEAN NOT NULL DEFAULT false,

    criado_em                       TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registros_setor_sigla ON registros (setor_sigla);
CREATE INDEX IF NOT EXISTS idx_registros_departamento_sigla ON registros (departamento_sigla);

-- Mantém atualizado_em em dia a cada UPDATE, sem depender da aplicação lembrar disso.
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registros_atualizado_em ON registros;
CREATE TRIGGER trg_registros_atualizado_em
    BEFORE UPDATE ON registros
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();
