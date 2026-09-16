import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { LigacaoMapa, NoMapa } from './layout';
import type { PosicoesSalvas } from '../documentos/armazenamento';

type Camera = { x: number; y: number; escala: number };

const ESCALA_MIN = 0.2;
const ESCALA_MAX = 2.4;
const LIMIAR_ARRASTO = 4;

type Props = {
  nos: NoMapa[];
  ligacoes: LigacaoMapa[];
  ligacoesExtras: LigacaoMapa[];
  encontrados: Set<string>;
  /** Ids em foco; vazio = ninguem esmaecido. */
  emFoco: Set<string>;
  posicoes: PosicoesSalvas;
  selecionadoId?: string;
  aoMover: (id: string, x: number, y: number) => void;
  aoSelecionar: (no: NoMapa) => void;
  aoAlternarRecolhido: (id: string) => void;
  aoAnexarDocumento: (alvo: string) => void;
  /** Muda de valor quando o App quer reenquadrar o mapa. */
  gatilhoCentralizar: number;
};

const MapaMental: React.FC<Props> = ({
  nos,
  ligacoes,
  ligacoesExtras,
  encontrados,
  emFoco,
  posicoes,
  selecionadoId,
  aoMover,
  aoSelecionar,
  aoAlternarRecolhido,
  aoAnexarDocumento,
  gatilhoCentralizar,
}) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, escala: 0.7 });

  const posicaoDe = useCallback(
    (no: NoMapa) => posicoes[no.id] ?? { x: no.x, y: no.y },
    [posicoes],
  );

  // ---- enquadrar ---------------------------------------------------------
  const centralizar = useCallback(() => {
    const area = areaRef.current;
    if (!area || !nos.length) {
      return;
    }

    const caixas = nos.map((no) => {
      const { x, y } = posicaoDe(no);
      return { x1: x - no.largura / 2, y1: y - no.altura / 2, x2: x + no.largura / 2, y2: y + no.altura / 2 };
    });

    const x1 = Math.min(...caixas.map((c) => c.x1));
    const y1 = Math.min(...caixas.map((c) => c.y1));
    const x2 = Math.max(...caixas.map((c) => c.x2));
    const y2 = Math.max(...caixas.map((c) => c.y2));

    const margem = 80;
    const escala = Math.min(
      ESCALA_MAX,
      Math.max(
        ESCALA_MIN,
        Math.min(
          (area.clientWidth - margem * 2) / Math.max(x2 - x1, 1),
          (area.clientHeight - margem * 2) / Math.max(y2 - y1, 1),
        ),
      ),
    );

    setCamera({
      escala,
      x: area.clientWidth / 2 - ((x1 + x2) / 2) * escala,
      y: area.clientHeight / 2 - ((y1 + y2) / 2) * escala,
    });
  }, [nos, posicaoDe]);

  useEffect(() => {
    centralizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatilhoCentralizar]);

  // Enquadra na primeira renderizacao, quando a area ja tem tamanho.
  const jaEnquadrou = useRef(false);
  useEffect(() => {
    if (!jaEnquadrou.current && nos.length) {
      jaEnquadrou.current = true;
      centralizar();
    }
  }, [nos, centralizar]);

  // ---- pan no fundo ------------------------------------------------------
  const arrastoFundo = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);

  const aoPressionarFundo = (evento: ReactPointerEvent<HTMLDivElement>) => {
    if (evento.button !== 0) {
      return;
    }
    (evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId);
    arrastoFundo.current = {
      x: evento.clientX,
      y: evento.clientY,
      camX: camera.x,
      camY: camera.y,
    };
  };

  const aoMoverFundo = (evento: ReactPointerEvent<HTMLDivElement>) => {
    const inicio = arrastoFundo.current;
    if (!inicio) {
      return;
    }
    setCamera((atual) => ({
      ...atual,
      x: inicio.camX + (evento.clientX - inicio.x),
      y: inicio.camY + (evento.clientY - inicio.y),
    }));
  };

  const aoSoltarFundo = () => {
    arrastoFundo.current = null;
  };

  // ---- zoom --------------------------------------------------------------
  const aplicarZoom = useCallback((fator: number, focoX?: number, focoY?: number) => {
    const area = areaRef.current;
    if (!area) {
      return;
    }
    const caixa = area.getBoundingClientRect();
    const alvoX = focoX ?? caixa.width / 2;
    const alvoY = focoY ?? caixa.height / 2;

    setCamera((atual) => {
      const escala = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, atual.escala * fator));
      const mundoX = (alvoX - atual.x) / atual.escala;
      const mundoY = (alvoY - atual.y) / atual.escala;
      return { escala, x: alvoX - mundoX * escala, y: alvoY - mundoY * escala };
    });
  }, []);

  // Listener nativo: o React usa listeners passivos e nao deixa dar preventDefault.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) {
      return;
    }

    const aoRolar = (evento: WheelEvent) => {
      evento.preventDefault();
      const caixa = area.getBoundingClientRect();
      aplicarZoom(
        evento.deltaY < 0 ? 1.12 : 1 / 1.12,
        evento.clientX - caixa.left,
        evento.clientY - caixa.top,
      );
    };

    area.addEventListener('wheel', aoRolar, { passive: false });
    return () => area.removeEventListener('wheel', aoRolar);
  }, [aplicarZoom]);

  // ---- arrasto de no -----------------------------------------------------
  const arrastoNo = useRef<{
    id: string;
    x: number;
    y: number;
    origemX: number;
    origemY: number;
    moveu: boolean;
  } | null>(null);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [previa, setPrevia] = useState<{ id: string; x: number; y: number } | null>(null);

  const aoPressionarNo = (evento: ReactPointerEvent<HTMLDivElement>, no: NoMapa) => {
    if (evento.button !== 0) {
      return;
    }
    evento.stopPropagation();
    (evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId);

    const posicao = posicaoDe(no);
    arrastoNo.current = {
      id: no.id,
      x: evento.clientX,
      y: evento.clientY,
      origemX: posicao.x,
      origemY: posicao.y,
      moveu: false,
    };
    setArrastandoId(no.id);
  };

  const aoMoverNo = (evento: ReactPointerEvent<HTMLDivElement>) => {
    const inicio = arrastoNo.current;
    if (!inicio) {
      return;
    }

    const dx = (evento.clientX - inicio.x) / camera.escala;
    const dy = (evento.clientY - inicio.y) / camera.escala;

    if (!inicio.moveu && Math.hypot(dx, dy) * camera.escala < LIMIAR_ARRASTO) {
      return;
    }

    inicio.moveu = true;
    setPrevia({ id: inicio.id, x: inicio.origemX + dx, y: inicio.origemY + dy });
  };

  const aoSoltarNo = (evento: ReactPointerEvent<HTMLDivElement>, no: NoMapa) => {
    const inicio = arrastoNo.current;
    arrastoNo.current = null;
    setArrastandoId(null);
    setPrevia(null);

    if (!inicio) {
      return;
    }

    if (inicio.moveu) {
      const dx = (evento.clientX - inicio.x) / camera.escala;
      const dy = (evento.clientY - inicio.y) / camera.escala;
      aoMover(no.id, inicio.origemX + dx, inicio.origemY + dy);
      return;
    }

    aoSelecionar(no);
  };

  // ---- desenho -----------------------------------------------------------
  const porId = useMemo(() => new Map(nos.map((no) => [no.id, no])), [nos]);

  const coordenada = (id: string) => {
    const no = porId.get(id);
    if (!no) {
      return null;
    }
    if (previa && previa.id === id) {
      return { x: previa.x, y: previa.y };
    }
    return posicaoDe(no);
  };

  const curva = (origem: { x: number; y: number }, destino: { x: number; y: number }) => {
    const meioX = (origem.x + destino.x) / 2;
    const meioY = (origem.y + destino.y) / 2;
    const dx = destino.x - origem.x;
    const dy = destino.y - origem.y;
    // Empurra o ponto de controle na perpendicular para a linha "respirar".
    const curvatura = 0.12;
    return `M ${origem.x} ${origem.y} Q ${meioX - dy * curvatura} ${meioY + dx * curvatura} ${destino.x} ${destino.y}`;
  };

  const TAMANHO_SVG = 12000;
  const centro = TAMANHO_SVG / 2;

  const esmaecido = (id: string) => emFoco.size > 0 && !emFoco.has(id);

  return (
    <div
      className="mapa-area"
      ref={areaRef}
      onPointerDown={aoPressionarFundo}
      onPointerMove={aoMoverFundo}
      onPointerUp={aoSoltarFundo}
      onPointerCancel={aoSoltarFundo}>
      <div
        className="mapa-camera"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.escala})`,
        }}>
        <svg
          className="mapa-linhas"
          width={TAMANHO_SVG}
          height={TAMANHO_SVG}
          style={{ left: -centro, top: -centro }}>
          <g transform={`translate(${centro}, ${centro})`}>
            {[...ligacoes, ...ligacoesExtras].map((ligacao) => {
              const origem = coordenada(ligacao.origemId);
              const destino = coordenada(ligacao.destinoId);
              if (!origem || !destino) {
                return null;
              }
              const apagada = esmaecido(ligacao.origemId) || esmaecido(ligacao.destinoId);
              return (
                <path
                  key={ligacao.id}
                  d={curva(origem, destino)}
                  className={`ligacao ligacao-${ligacao.tipo}${apagada ? ' esmaecido' : ''}`}
                />
              );
            })}
          </g>
        </svg>

        {nos.map((no) => {
          const posicao = previa && previa.id === no.id ? previa : posicaoDe(no);
          const achado = encontrados.has(no.id);

          return (
            <div
              key={no.id}
              className={[
                'no',
                `no-${no.tipo}`,
                selecionadoId === no.id ? 'selecionado' : '',
                arrastandoId === no.id ? 'arrastando' : '',
                achado ? 'achado' : '',
                esmaecido(no.id) ? 'esmaecido' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                width: no.largura,
                minHeight: no.altura,
                transform: `translate(${posicao.x - no.largura / 2}px, ${posicao.y - no.altura / 2}px)`,
                borderColor: `${no.cor}99`,
              }}
              onPointerDown={(evento) => aoPressionarNo(evento, no)}
              onPointerMove={aoMoverNo}
              onPointerUp={(evento) => aoSoltarNo(evento, no)}>
              {no.tipo === 'competencia' && (
                <span className="pilula-situacao" style={{ background: no.cor }} />
              )}

              <div className="no-titulo">{no.rotulo}</div>
              {no.subtitulo ? <div className="no-subtitulo">{no.subtitulo}</div> : null}

              <div className="no-rodape">
                {no.documentos > 0 && (
                  <span className="selo selo-doc" title="Documentos alocados">
                    📎 {no.documentos}
                  </span>
                )}

                {no.recolhivel && (
                  <button
                    type="button"
                    className="selo selo-acao"
                    title={no.recolhido ? 'Expandir ramo' : 'Recolher ramo'}
                    onPointerDown={(evento) => evento.stopPropagation()}
                    onClick={(evento) => {
                      evento.stopPropagation();
                      aoAlternarRecolhido(no.id);
                    }}>
                    {no.recolhido ? `▸ ${no.filhosOcultos}` : '▾'}
                  </button>
                )}

                {no.alvo && (
                  <button
                    type="button"
                    className="selo selo-acao"
                    title="Anexar documento a este nó"
                    onPointerDown={(evento) => evento.stopPropagation()}
                    onClick={(evento) => {
                      evento.stopPropagation();
                      aoAnexarDocumento(no.alvo as string);
                    }}>
                    + 📎
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mapa-controles">
        <button type="button" onClick={() => aplicarZoom(1.2)} title="Aproximar">
          +
        </button>
        <button type="button" onClick={() => aplicarZoom(1 / 1.2)} title="Afastar">
          −
        </button>
        <button type="button" onClick={centralizar} title="Enquadrar tudo">
          ⤢
        </button>
        <span className="mapa-zoom">{Math.round(camera.escala * 100)}%</span>
      </div>

      <div className="mapa-dica">
        arraste o fundo para mover · roda do mouse para zoom · arraste os nós · clique para focar
      </div>
    </div>
  );
};

export default MapaMental;
