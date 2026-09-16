import {
  calcularSituacao,
  corPorSituacao,
  rotuloSituacao,
  type Registro,
} from '../../../src/data/registros';
import {
  chaveAlvo,
  documentosDoAlvo,
  formatarTamanho,
  iconeTipoDocumento,
  idDaDivisao,
  idDaPessoa,
  type Documento,
} from '../../../src/data/documentos';

type Props = {
  registro: Registro;
  documentos: Documento[];
  aoFechar: () => void;
  aoAnexarDocumento: (alvo: string) => void;
};

const Resposta: React.FC<{ rotulo: string; valor?: boolean }> = ({ rotulo, valor }) => (
  <div className={`resposta ${valor === true ? 'sim' : valor === false ? 'nao' : 'vazio'}`}>
    <span>{rotulo}</span>
    <strong>{valor === true ? 'Sim' : valor === false ? 'Não' : '—'}</strong>
  </div>
);

const Campo: React.FC<{ rotulo: string; valor?: string }> = ({ rotulo, valor }) =>
  valor ? (
    <p className="campo">
      <span>{rotulo}</span>
      {valor}
    </p>
  ) : null;

/** Modal com a competencia inteira e os documentos de quem responde por ela. */
const DetalheRegistro: React.FC<Props> = ({
  registro,
  documentos,
  aoFechar,
  aoAnexarDocumento,
}) => {
  const situacao = calcularSituacao(registro);

  const idPessoa = idDaPessoa(registro);
  const idDivisao = idDaDivisao(registro);
  const daPessoa = documentosDoAlvo(documentos, 'pessoa', idPessoa);
  const daDivisao = documentosDoAlvo(documentos, 'divisao', idDivisao);

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal" onClick={(evento) => evento.stopPropagation()}>
        <header className="modal-cabecalho">
          <span className="situacao" style={{ background: corPorSituacao[situacao] }}>
            {rotuloSituacao[situacao]}
          </span>
          <button type="button" className="botao-fechar" onClick={aoFechar}>
            ✕
          </button>
        </header>

        <h2>{registro.competencia}</h2>
        <p className="lotacao">
          {registro.setorSigla} · {registro.setor}
          <br />
          {registro.responsavel} — {registro.cargo}
        </p>

        <div className="respostas">
          <Resposta rotulo="Sistema atende" valor={registro.sistemaAtende} />
          <Resposta rotulo="Estruturado no SIG" valor={registro.estruturadoNoSistema} />
          <Resposta rotulo="Houve treinamento" valor={registro.houveTreinamento} />
          <Resposta rotulo="Acesso à camada" valor={registro.acessoCamadaConcedido} />
          <Resposta rotulo="Acesso ao módulo" valor={registro.acessoModuloConcedido} />
          <Resposta rotulo="Já iniciou no SIG" valor={registro.iniciouAtividade} />
          <Resposta rotulo="Tem problema" valor={registro.temProblema} />
          <Resposta rotulo="Tem chamado" valor={registro.temChamado} />
        </div>

        <Campo rotulo="Como atende" valor={registro.comoAtende} />
        <Campo rotulo="Informações acessadas" valor={registro.informacoesAcessadas} />
        <Campo rotulo="Nível de acesso à camada" valor={registro.nivelAcessoCamada} />
        <Campo rotulo="Módulo do SIG" valor={registro.moduloSig} />
        <Campo rotulo="Nível de acesso ao módulo" valor={registro.nivelAcessoModulo} />
        <Campo rotulo="Problema relatado" valor={registro.detalheProblema} />
        <Campo rotulo="Observação" valor={registro.observacao} />

        <section className="documentos-do-registro">
          <div className="documentos-topo">
            <h3>Documentos</h3>
            <div>
              <button
                type="button"
                onClick={() => aoAnexarDocumento(chaveAlvo('pessoa', idPessoa))}>
                + para {registro.responsavel.split(' ')[0]}
              </button>
              <button
                type="button"
                onClick={() => aoAnexarDocumento(chaveAlvo('divisao', idDivisao))}>
                + para {registro.setorSigla}
              </button>
            </div>
          </div>

          {daPessoa.length + daDivisao.length === 0 ? (
            <p className="vazio">Nenhum documento alocado a esta pessoa nem à divisão.</p>
          ) : (
            <ul>
              {[...daPessoa, ...daDivisao].map((documento) => (
                <li key={documento.id}>
                  <span>
                    {iconeTipoDocumento[documento.tipo]} {documento.titulo}
                  </span>
                  <span className={`etiqueta etiqueta-${documento.alvoTipo}`}>
                    {documento.alvoRotulo}
                  </span>
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default DetalheRegistro;
