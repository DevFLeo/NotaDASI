import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type PropsIcone = {
  tamanho?: number;
  cor: string;
};

/** Engrenagem — usada na aba e no cabeçalho de Ajustes. */
export const IconeEngrenagem: React.FC<PropsIcone> = ({ tamanho = 20, cor }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      stroke={cor}
      strokeWidth={1.8}
    />
    <Path
      d="M19.4 13.5c.04-.33.06-.66.06-1s-.02-.67-.06-1l2.02-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.38.96a7.4 7.4 0 0 0-1.73-1l-.36-2.53a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.53c-.63.24-1.2.58-1.73 1l-2.38-.96a.5.5 0 0 0-.6.22L2.7 9.28a.5.5 0 0 0 .12.64L4.84 11.5c-.04.33-.06.66-.06 1s.02.67.06 1L2.82 15.08a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.4.31.6.22l2.38-.96c.53.42 1.1.76 1.73 1l.36 2.53c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.53a7.4 7.4 0 0 0 1.73-1l2.38.96c.2.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.4 13.5Z"
      stroke={cor}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </Svg>
);

/** Sol — tema claro. */
export const IconeSol: React.FC<PropsIcone> = ({ tamanho = 16, cor }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={4.2} stroke={cor} strokeWidth={1.8} />
    <Path
      d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"
      stroke={cor}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </Svg>
);

/** Lua — tema escuro. */
export const IconeLua: React.FC<PropsIcone> = ({ tamanho = 16, cor }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"
      stroke={cor}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </Svg>
);

/** Aparelho — tema "do sistema". */
export const IconeAparelho: React.FC<PropsIcone> = ({ tamanho = 16, cor }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 5.5c0-.83.67-1.5 1.5-1.5h13c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 14.5v-9Z"
      stroke={cor}
      strokeWidth={1.8}
    />
    <Path d="M9 20h6M12 16v4" stroke={cor} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

/** Banco de dados / armazenamento — usado na seção Dados. */
export const IconeBanco: React.FC<PropsIcone> = ({ tamanho = 18, cor }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 7c4.42 0 8-1.12 8-2.5S16.42 2 12 2 4 3.12 4 4.5 7.58 7 12 7Z"
      stroke={cor}
      strokeWidth={1.8}
    />
    <Path
      d="M4 4.5V12c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V4.5M4 12v7.5C4 20.88 7.58 22 12 22s8-1.12 8-2.5V12"
      stroke={cor}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Lista — aba de competências. */
export const IconeLista: React.FC<PropsIcone> = ({ tamanho = 20, cor }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 6h12M8 12h12M8 18h12"
      stroke={cor}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <Circle cx={4} cy={6} r={1.3} fill={cor} />
    <Circle cx={4} cy={12} r={1.3} fill={cor} />
    <Circle cx={4} cy={18} r={1.3} fill={cor} />
  </Svg>
);

/** Mapa mental — nós conectados. */
export const IconeMapa: React.FC<PropsIcone> = ({ tamanho = 20, cor }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 6v4M8.5 17 11 12M15.5 17 13 12"
      stroke={cor}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <Circle cx={12} cy={4} r={2} stroke={cor} strokeWidth={1.8} />
    <Circle cx={7} cy={19} r={2} stroke={cor} strokeWidth={1.8} />
    <Circle cx={17} cy={19} r={2} stroke={cor} strokeWidth={1.8} />
  </Svg>
);

/** Servidor / integração remota — usado na seção Integração. */
export const IconeServidor: React.FC<PropsIcone> = ({ tamanho = 18, cor }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 5.5c0-.83.67-1.5 1.5-1.5h13c.83 0 1.5.67 1.5 1.5v3c0 .83-.67 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 8.5v-3ZM4 14.5c0-.83.67-1.5 1.5-1.5h13c.83 0 1.5.67 1.5 1.5v3c0 .83-.67 1.5-1.5 1.5h-13a1.5 1.5 0 0 1-1.5-1.5v-3Z"
      stroke={cor}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    <Circle cx={7.2} cy={7} r={0.9} fill={cor} />
    <Circle cx={7.2} cy={16} r={0.9} fill={cor} />
  </Svg>
);

/** Lupa — campo de busca. */
export const IconeLupa: React.FC<PropsIcone> = ({ tamanho = 18, cor }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Circle cx={11} cy={11} r={6.5} stroke={cor} strokeWidth={1.8} />
    <Path d="m16 16 4.5 4.5" stroke={cor} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

/** X — limpar o campo de busca. */
export const IconeX: React.FC<PropsIcone> = ({ tamanho = 16, cor }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6 6 18" stroke={cor} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);
