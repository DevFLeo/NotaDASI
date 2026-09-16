/**
 * Stub de '@react-native/assets-registry/registry'.
 *
 * O react-native-svg importa este módulo em `lib/resolveAssetUri.js` para
 * resolver `<Image href={require('./foto.png')} />` dentro de um SVG. O pacote
 * real é interno do React Native e só existe no grafo do Metro — não está
 * instalado aqui, e por isso o build para o navegador quebrava.
 *
 * O NotaDASI nunca usa esse caminho: os dois únicos SVGs do app são
 * desenhados com primitivas (src/mapa/MapaMental.tsx usa Svg + Line;
 * src/tema/Icones.tsx usa Svg + Circle + Path). Nenhuma imagem é registrada.
 *
 * Mantemos o registro funcional em memória em vez de lançar erro, para o caso
 * de a biblioteca tocar nele durante a inicialização. Se um dia o app passar a
 * usar <Image> dentro de um SVG, é aqui que isso aparece — e aí vale instalar
 * o pacote de verdade em vez de ampliar este stub.
 */
type Asset = Record<string, unknown>;

const assets: Asset[] = [];

export const registerAsset = (asset: Asset): number => assets.push(asset);

export const getAssetByID = (assetId: number): Asset | undefined => assets[assetId - 1];

export default { registerAsset, getAssetByID };
