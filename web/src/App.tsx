import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  rotuloSituacao,
  corPorSituacao,
  type Registro,
  type SituacaoAdesao,
} from '../../src/data/registros';
import { listarAlvos, type Documento } from '../../src/data/documentos';
import { origemDados, registros } from './dados/fonte';
import MapaMental from './mapa/MapaMental';
import {
  ligacoesPorCamada,
  montarMapa,
  subarvoreEAncestrais,
  type NoMapa,
} from './mapa/layout';
import PainelDocumentos from './documentos/PainelDocumentos';
import DetalheRegistro from './componentes/DetalheRegistro';
import {
  exportarAcervo,
  importarAcervo,
  lerDocumentos,
  lerPosicoes,
  lerPreferencias,
  salvarDocumentos,
  salvarPosicoes,
  salvarPreferencias,
  type PosicoesSalvas,
} from './documentos/armazenamento';

const SITUACOES: SituacaoAdesao[] = ['aderido', 'parcial', 'pendente', 'problema'];

const App: React.FC = () => {
  const [documentos, setDocumentos] = useState<Documento[]>(() => lerDocumentos());
  const [posicoes, setPosicoes] = useState<PosicoesSalvas>(() => lerPosicoes());
  const [preferencias, setPreferencias] = useState(() => lerPreferencias());

  const [recolhidos, setRecolhidos] = useState<Set<string>>(() => new Set());
  const [situacoes, setSituacoes] = useState<Set<SituacaoAdesao>>(() => new Set());
  const [busca, setBusca] = useState('');

  const [selecionado, setSelecionado] = useState<NoMapa | null>(null);
  const [registroAberto, setRegistroAberto] = useState<Registro | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [alvoInicial, setAlvoInicial] = useState<string | undefined>();
  const [documentoInicial, setDocumentoInicial] = useState<Documento | undefined>();
  const [gatilhoCentralizar, setGatilhoCentralizar] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => salvarDocumentos(documentos), [documentos]);
  useEffect(() => salvarPosicoes(posicoes), [posicoes]);
  useEffect(() => salvarPreferencias(preferencias), [preferencias]);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setSelecionado(null);
        setRegistroAberto(null);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  useEffect(() => {
    if (!aviso) {
      return;
    }
    const id = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(id);
  }, [aviso]);

  const alvos = useMemo(() => listarAlvos(registros), []);

  const { nos, ligacoes, encontrados, paiDe } = useMemo(
    () =>
      montarMapa({
        registros,
        documentos,
        recolhidos,
        situacoes,
        mostrarDocumentos: preferencias.mostrarDocumentos,
        busca,
      }),
    [documentos, recolhidos, situacoes, preferencias.mostrarDocumentos, busca],
  );

  const ligacoesExtras = useMemo(
    () => (preferencias.mostrarCamadas ? ligacoesPorCamada(nos) : []),
    [nos, preferencias.mostrarCamadas],
  );

  // Foco: o no clicado manda; sem clique, a busca e quem destaca.
  const emFoco = useMemo(() => {
    if (selecionado) {
      return subarvoreEAncestrais(selecionado.id, paiDe);
    }

    if (encontrados.size) {
      const conjunto = new Set<string>();
      encontrados.forEach((id) => {
        subarvoreEAncestrais(id, paiDe).forEach((relacionado) => conjunto.add(relacionado));
      });
      return conjunto;
    }

    return new Set<string>();
  }, [selecionado, encontrados, paiDe]);

  const abrirPainel = useCallback((alvo?: string, documento?: Documento) => {
    setAlvoInicial(alvo);
    setDocumentoInicial(documento);
    setPainelAberto(true);
  }, []);

  const aoSelecionarNo = useCallback(
    (no: NoMapa) => {
      setSelecionado((atual) => (atual?.id === no.id ? null : no));

      if (no.tipo === 'competencia' && no.registro) {
        setRegistroAberto(no.registro);
      } else if (no.tipo === 'documento' && no.documento) {
        abrirPainel(undefined, no.documento);
      }
    },
    [abrirPainel],
  );

  const alternarRecolhido = useCallback((id: string) => {
    setRecolhidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  }, []);

  const alternarSituacao = (situacao: SituacaoAdesao) => {
    setSituacoes((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(situacao)) {
        proximo.delete(situacao);
      } else {
        proximo.add(situacao);
      }
      return proximo;
    });
  };

  const salvarDocumento = (documento: Documento) => {
    setDocumentos((atual) => {
      const existe = atual.some((item) => item.id === documento.id);
      return existe ? atual.map((item) => (item.id === documento.id ? documento : item)) : [...atual, documento];
    });
    setDocumentoInicial(undefined);
    setAviso(`Documento "${documento.titulo}" alocado a ${documento.alvoRotulo}.`);
  };

  const removerDocumento = (id: string) => {
    setDocumentos((atual) => atual.filter((documento) => documento.id !== id));
    setDocumentoInicial(undefined);
  };

  const importar = async (arquivo: File) => {
    try {
      const importados = await importarAcervo(arquivo);
      setDocumentos((atual) => {
        const ids = new Set(atual.map((documento) => documento.id));
        return [...atual, ...importados.filter((documento) => !ids.has(documento.id))];
      });
      setAviso(`${importados.length} documento(s) lidos do arquivo.`);
    } catch (erro) {
      setAviso((erro as Error).message);
    }
  };

  const totalDocumentos = documentos.length;

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          <strong>NotaDASI</strong>
          <span>mapa mental · web</span>
        </div>

        <input
          className="busca"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar pessoa, divisão, competência, módulo…"
        />

        <div className="filtros">
          {SITUACOES.map((situacao) => (
            <button
              key={situacao}
              type="button"
              className={`chip ${situacoes.has(situacao) ? 'ativo' : ''}`}
              style={{ '--cor-chip': corPorSituacao[situacao] } as React.CSSProperties}
              onClick={() => alternarSituacao(situacao)}>
              {rotuloSituacao[situacao]}
            </button>
          ))}
        </div>

        <div className="acoes-barra">
          <label className="alternador">
            <input
              type="checkbox"
              checked={preferencias.mostrarDocumentos}
              onChange={(evento) =>
                setPreferencias((atual) => ({ ...atual, mostrarDocumentos: evento.target.checked }))
              }
            />
            documentos no mapa
          </label>

          <label className="alternador">
            <input
              type="checkbox"
              checked={preferencias.mostrarCamadas}
              onChange={(evento) =>
                setPreferencias((atual) => ({ ...atual, mostrarCamadas: evento.target.checked }))
              }
            />
            ligações por camada
          </label>

          <button type="button" onClick={() => setPosicoes({})} title="Voltar ao layout automático">
            reposicionar
          </button>

          <button type="button" onClick={() => setGatilhoCentralizar((valor) => valor + 1)}>
            enquadrar
          </button>

          <button type="button" className="botao-primario" onClick={() => abrirPainel()}>
            📎 Documentos ({totalDocumentos})
          </button>
        </div>
      </header>

      <main className="conteudo">
        <MapaMental
          nos={nos}
          ligacoes={ligacoes}
          ligacoesExtras={ligacoesExtras}
          encontrados={encontrados}
          emFoco={emFoco}
          posicoes={posicoes}
          selecionadoId={selecionado?.id}
          aoMover={(id, x, y) => setPosicoes((atual) => ({ ...atual, [id]: { x, y } }))}
          aoSelecionar={aoSelecionarNo}
          aoAlternarRecolhido={alternarRecolhido}
          aoAnexarDocumento={(alvo) => abrirPainel(alvo)}
          gatilhoCentralizar={gatilhoCentralizar}
        />

        {painelAberto && (
          <PainelDocumentos
            alvos={alvos}
            documentos={documentos}
            alvoInicial={alvoInicial}
            documentoInicial={documentoInicial}
            aoSalvar={salvarDocumento}
            aoRemover={removerDocumento}
            aoFechar={() => setPainelAberto(false)}
            aoExportar={() => exportarAcervo(documentos)}
            aoImportar={importar}
          />
        )}
      </main>

      <footer className="legenda">
        <span className="fonte">
          fonte dos dados: <strong>{origemDados}</strong> · {registros.length} competências
        </span>
        {SITUACOES.map((situacao) => (
          <span key={situacao} className="item-legenda">
            <i style={{ background: corPorSituacao[situacao] }} />
            {rotuloSituacao[situacao]}
          </span>
        ))}
        <span className="item-legenda">
          <i className="tracejado" />
          mesma camada do SIG em divisões diferentes
        </span>
        <span className="item-legenda">📎 documento alocado</span>
      </footer>

      {registroAberto && (
        <DetalheRegistro
          registro={registroAberto}
          documentos={documentos}
          aoFechar={() => setRegistroAberto(null)}
          aoAnexarDocumento={(alvo) => {
            abrirPainel(alvo);
            setRegistroAberto(null);
          }}
        />
      )}

      {aviso && <div className="aviso">{aviso}</div>}
    </div>
  );
};

export default App;
