/**
 * Entrada do alvo PC (navegador).
 *
 * Equivale ao index.js do Android. Não existe uma segunda cópia da tela nem
 * dos dados aqui: monta os MESMOS provedores e a MESMA porta de entrada do
 * App.tsx, e só troca a casca por `RaizPC` — que decide entre o layout de
 * monitor (barra lateral + mapa em foco) e o de celular conforme a largura da
 * janela. Ver pc/README.md para o que é e o que não é compartilhado.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRegistry } from 'react-native';
import App, { Provedores } from '../App';
import PortaDeEntrada from '../src/auth/PortaDeEntrada';
import RaizPC from './RaizPC';
import { name as appName } from '../app.json';

AppRegistry.registerComponent(appName, () => App);

const raiz = document.getElementById('root');

if (!raiz) {
  throw new Error('Elemento #root não encontrado em pc/index.html');
}

/**
 * A ordem é a mesma do celular: provedores → login → casca. Só a casca muda.
 * Montar a porta de entrada aqui (e não dentro de RaizPC) mantém a regra de
 * "tem sessão?" num lugar só para os dois alvos.
 */
const AplicacaoPC: React.FC = () => (
  <Provedores>
    <PortaDeEntrada>
      <RaizPC />
    </PortaDeEntrada>
  </Provedores>
);

// O react-native-web tem seu próprio runApplication, mas ele usa o
// ReactDOM.render legado em algumas versões. Montamos pela raiz do React 19
// diretamente para ficar no caminho suportado.
createRoot(raiz).render(
  <React.StrictMode>
    <AplicacaoPC />
  </React.StrictMode>,
);
