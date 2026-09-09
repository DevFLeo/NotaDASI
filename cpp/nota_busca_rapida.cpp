#include <algorithm>
#include <cctype>
#include <cstddef>
#include <string>
#include <vector>

namespace nota_dasi {

namespace {

// Mapeia a segunda metade das sequencias UTF-8 de 2 bytes iniciadas por 0xC3
// (faixa Latin-1: acentos usados no portugues) para o equivalente ASCII.
char dobrarAcentoLatin1(unsigned char segundoByte) {
    // Maiusculas: A-grave..A-anel (0x80-0x85), C-cedilha (0x87), E (0x88-0x8B),
    // I (0x8C-0x8F), N-til (0x91), O (0x92-0x96), U (0x99-0x9C), Y (0x9D).
    if (segundoByte >= 0x80 && segundoByte <= 0x85) return 'a';
    if (segundoByte == 0x87) return 'c';
    if (segundoByte >= 0x88 && segundoByte <= 0x8B) return 'e';
    if (segundoByte >= 0x8C && segundoByte <= 0x8F) return 'i';
    if (segundoByte == 0x91) return 'n';
    if (segundoByte >= 0x92 && segundoByte <= 0x96) return 'o';
    if (segundoByte >= 0x99 && segundoByte <= 0x9C) return 'u';
    if (segundoByte == 0x9D) return 'y';

    // Minusculas: mesma ordem, deslocada em 0x20.
    if (segundoByte >= 0xA0 && segundoByte <= 0xA5) return 'a';
    if (segundoByte == 0xA7) return 'c';
    if (segundoByte >= 0xA8 && segundoByte <= 0xAB) return 'e';
    if (segundoByte >= 0xAC && segundoByte <= 0xAF) return 'i';
    if (segundoByte == 0xB1) return 'n';
    if (segundoByte >= 0xB2 && segundoByte <= 0xB6) return 'o';
    if (segundoByte >= 0xB9 && segundoByte <= 0xBC) return 'u';
    if (segundoByte == 0xBD) return 'y';

    return '\0';  // Sem equivalente ASCII.
}

}  // namespace

std::string normalizarTexto(const std::string& texto) {
    std::string resultado;
    resultado.reserve(texto.size());

    for (std::size_t posicao = 0; posicao < texto.size(); ++posicao) {
        const unsigned char caractere = static_cast<unsigned char>(texto[posicao]);

        // Sequencia UTF-8 de 2 bytes com acento latino: converte para ASCII.
        if (caractere == 0xC3 && posicao + 1 < texto.size()) {
            const unsigned char proximo = static_cast<unsigned char>(texto[posicao + 1]);
            const char equivalente = dobrarAcentoLatin1(proximo);

            if (equivalente != '\0') {
                resultado.push_back(equivalente);
                ++posicao;  // Consome o segundo byte da sequencia.
                continue;
            }
        }

        resultado.push_back(static_cast<char>(std::tolower(caractere)));
    }

    return resultado;
}

std::vector<int> buscarTextoRapido(const std::string& textoCompleto, const std::string& termoBusca) {
    std::vector<int> ocorrencias;

    if (termoBusca.empty() || textoCompleto.empty()) {
        return ocorrencias;
    }

    const std::string textoNormalizado = normalizarTexto(textoCompleto);
    const std::string termoNormalizado = normalizarTexto(termoBusca);

    std::size_t posicaoAtual = 0;

    while ((posicaoAtual = textoNormalizado.find(termoNormalizado, posicaoAtual)) != std::string::npos) {
        ocorrencias.push_back(static_cast<int>(posicaoAtual));
        posicaoAtual += termoNormalizado.size();
    }

    return ocorrencias;
}

std::string descriptografarTextoSimulado(const std::string& textoCriptografado) {
    std::string textoClaro;
    textoClaro.reserve(textoCriptografado.size());

    for (unsigned char caractere : textoCriptografado) {
        textoClaro.push_back(static_cast<char>(caractere - 3));
    }

    return textoClaro;
}

}  // namespace nota_dasi
