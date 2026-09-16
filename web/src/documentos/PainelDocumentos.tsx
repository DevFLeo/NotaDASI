import { useEffect, useMemo, useRef, useState } from 'react';
import {
  chaveAlvo,
  formatarTamanho,
  iconeTipoDocumento,
  novoId,
  rotuloTipoAlvo,
  rotuloTipoDocumento,
  validarDocumento,
  type AlvoDisponivel,
  type Documento,
  type TipoAlvo,
  type TipoDocumento,
} from '../../../src/data/documentos';
import { lerArquivo } from './armazenamento';

type Props = {
  alvos: AlvoDisponivel[];
  documentos: Documento[];
  /** Chave "tipo:id" pre-selecionada (veio do botao + no no mapa). */
  alvoInicial?: string;
  /** Documento que o usuario clicou no mapa — abre ja em modo edicao. */
  documentoInicial?: Documento;
  aoSalvar: (documento: Documento) => void;
  aoRemover: (id: string) => void;
  aoFechar: () => void;
  aoExportar: () => void;
  aoImportar: (arquivo: File) => void;
};

type Anexo = { nome: string; tipo: string; tamanho: number; dados: string };

const tipos: TipoDocumento[] = ['oficio', 'portaria', 'ata', 'manual', 'planilha', 'mapa', 'outro'];

/**
 * Painel lateral onde o documento e alocado a uma DIVISAO ou a uma PESSOA
 * (ou ao departamento inteiro). O anexo pode ser um arquivo de ate 2 MB
 * (guardado em base64 no navegador) ou um link externo.
 */
const PainelDocumentos: React.FC<Props> = ({
  alvos,
  documentos,
  alvoInicial,
  documentoInicial,
  aoSalvar,
  aoRemover,
  aoFechar,
  aoExportar,
  aoImportar,
}) => {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoDocumento>('oficio');
  const [alvo, setAlvo] = useState(alvoInicial ?? '');
  const [descricao, setDescricao] = useState('');
  const [url, setUrl] = useState('');
  const [anexo, setAnexo] = useState<Anexo | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [filtro, setFiltro] = useState('');

  const entradaArquivo = useRef<HTMLInputElement>(null);
  const entradaImportacao = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (alvoInicial) {
      setAlvo(alvoInicial);
    }
  }, [alvoInicial]);

  const limpar = () => {
    setEditandoId(null);
    setTitulo('');
    setTipo('oficio');
    setDescricao('');
    setUrl('');
    setAnexo(null);
    setErros([]);
    if (entradaArquivo.current) {
      entradaArquivo.current.value = '';
    }
  };

  const editar = (documento: Documento) => {
    setEditandoId(documento.id);
    setTitulo(documento.titulo);
    setTipo(documento.tipo);
    setAlvo(chaveAlvo(documento.alvoTipo, documento.alvoId));
    setDescricao(documento.descricao ?? '');
    setUrl(documento.url ?? '');
    setAnexo(
      documento.arquivoDados
        ? {
            nome: documento.arquivoNome ?? 'arquivo',
            tipo: documento.arquivoTipo ?? '',
            tamanho: documento.arquivoTamanho ?? 0,
            dados: documento.arquivoDados,
          }
        : null,
    );
    setErros([]);
  };

  useEffect(() => {
    if (documentoInicial) {
      editar(documentoInicial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentoInicial?.id]);

  const escolherArquivo = async (arquivo?: File) => {
    if (!arquivo) {
      return;
    }
    try {
      setAnexo(await lerArquivo(arquivo));
      setErros([]);
    } catch (erro) {
      setErros([(erro as Error).message]);
    }
  };

  const submeter = (evento: React.FormEvent) => {
    evento.preventDefault();

    const escolhido = alvos.find((item) => chaveAlvo(item.tipo, item.id) === alvo);

    const documento: Documento = {
      id: editandoId ?? novoId(),
      titulo: titulo.trim(),
      tipo,
      alvoTipo: (escolhido?.tipo ?? 'divisao') as TipoAlvo,
      alvoId: escolhido?.id ?? '',
      alvoRotulo: escolhido?.rotulo ?? '',
      descricao: descricao.trim() || undefined,
      url: url.trim() || undefined,
      arquivoNome: anexo?.nome,
      arquivoTipo: anexo?.tipo,
      arquivoTamanho: anexo?.tamanho,
      arquivoDados: anexo?.dados,
      criadoEm: new Date().toISOString(),
    };

    const problemas = validarDocumento(documento);
    if (problemas.length) {
      setErros(problemas);
      return;
    }

    aoSalvar(documento);
    limpar();
  };

  const listados = useMemo(() => {
    const alvoTexto = filtro.trim().toLowerCase();
    const filtrados = alvoTexto
      ? documentos.filter((documento) =>
          `${documento.titulo} ${documento.alvoRotulo} ${documento.descricao ?? ''}`
            .toLowerCase()
            .includes(alvoTexto),
        )
      : documentos;

    return [...filtrados].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [documentos, filtro]);

  const porTipoAlvo = (tipoAlvo: TipoAlvo) => alvos.filter((item) => item.tipo === tipoAlvo);

  return (
    <aside className="painel">
      <header className="painel-cabecalho">
        <h2>Documentos</h2>
        <button type="button" className="botao-fechar" onClick={aoFechar} title="Fechar painel">
          ✕
        </button>
      </header>

      <form className="formulario" onSubmit={submeter}>
        <h3>{editandoId ? 'Editar documento' : 'Novo documento'}</h3>

        <label>
          Título
          <input
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            placeholder="Ex.: Portaria 045/2025 — acesso à camada de lotes"
          />
        </label>

        <div className="linha">
          <label>
            Tipo
            <select value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoDocumento)}>
              {tipos.map((item) => (
                <option key={item} value={item}>
                  {iconeTipoDocumento[item]} {rotuloTipoDocumento[item]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Alocado a
            <select value={alvo} onChange={(evento) => setAlvo(evento.target.value)}>
              <option value="">— escolha —</option>
              {(['departamento', 'divisao', 'pessoa'] as TipoAlvo[]).map((tipoAlvo) => (
                <optgroup key={tipoAlvo} label={rotuloTipoAlvo[tipoAlvo]}>
                  {porTipoAlvo(tipoAlvo).map((item) => (
                    <option key={chaveAlvo(item.tipo, item.id)} value={chaveAlvo(item.tipo, item.id)}>
                      {item.rotulo} — {item.detalhe}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <label>
          Link (Drive, SEI, intranet…)
          <input
            value={url}
            onChange={(evento) => setUrl(evento.target.value)}
            placeholder="https://…"
          />
        </label>

        <label>
          Arquivo (até 2 MB)
          <input
            ref={entradaArquivo}
            type="file"
            onChange={(evento) => escolherArquivo(evento.target.files?.[0])}
          />
        </label>

        {anexo && (
          <p className="anexo-atual">
            📎 {anexo.nome} · {formatarTamanho(anexo.tamanho)}
            <button type="button" className="ligacao-botao" onClick={() => setAnexo(null)}>
              remover
            </button>
          </p>
        )}

        <label>
          Observação
          <textarea
            value={descricao}
            rows={2}
            onChange={(evento) => setDescricao(evento.target.value)}
            placeholder="Para que serve, onde foi protocolado…"
          />
        </label>

        {erros.length > 0 && (
          <ul className="erros">
            {erros.map((erro) => (
              <li key={erro}>{erro}</li>
            ))}
          </ul>
        )}

        <div className="acoes">
          <button type="submit" className="botao-primario">
            {editandoId ? 'Salvar alterações' : 'Anexar documento'}
          </button>
          {editandoId && (
            <button type="button" onClick={limpar}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="painel-lista">
        <div className="lista-cabecalho">
          <input
            className="filtro"
            value={filtro}
            onChange={(evento) => setFiltro(evento.target.value)}
            placeholder={`Filtrar ${documentos.length} documento(s)…`}
          />
          <button type="button" onClick={aoExportar} title="Baixar JSON com tudo">
            ⤓
          </button>
          <button
            type="button"
            onClick={() => entradaImportacao.current?.click()}
            title="Importar JSON">
            ⤒
          </button>
          <input
            ref={entradaImportacao}
            type="file"
            accept="application/json"
            hidden
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              if (arquivo) {
                aoImportar(arquivo);
              }
              evento.target.value = '';
            }}
          />
        </div>

        {listados.length === 0 ? (
          <p className="vazio">
            Nenhum documento ainda. Use o botão <strong>+ 📎</strong> num nó do mapa para já vir com
            a divisão ou a pessoa preenchida.
          </p>
        ) : (
          <ul className="documentos">
            {listados.map((documento) => (
              <li key={documento.id} className="documento">
                <div className="documento-topo">
                  <span className="documento-titulo">
                    {iconeTipoDocumento[documento.tipo]} {documento.titulo}
                  </span>
                  <span className={`etiqueta etiqueta-${documento.alvoTipo}`}>
                    {rotuloTipoAlvo[documento.alvoTipo]}: {documento.alvoRotulo}
                  </span>
                </div>

                {documento.descricao && <p className="documento-descricao">{documento.descricao}</p>}

                <div className="documento-acoes">
                  {documento.arquivoDados && (
                    <a href={documento.arquivoDados} download={documento.arquivoNome}>
                      baixar ({formatarTamanho(documento.arquivoTamanho)})
                    </a>
                  )}
                  {documento.url && (
                    <a href={documento.url} target="_blank" rel="noreferrer">
                      abrir link
                    </a>
                  )}
                  <button type="button" className="ligacao-botao" onClick={() => editar(documento)}>
                    editar
                  </button>
                  <button
                    type="button"
                    className="ligacao-botao perigo"
                    onClick={() => aoRemover(documento.id)}>
                    excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};

export default PainelDocumentos;
