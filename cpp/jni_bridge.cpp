#include "nota_busca_rapida.h"

#if defined(__ANDROID__)

namespace {

std::string jstringParaStdString(JNIEnv* env, jstring valor) {
    if (valor == nullptr) {
        return {};
    }

    const char* caracteres = env->GetStringUTFChars(valor, nullptr);
    std::string resultado(caracteres);
    env->ReleaseStringUTFChars(valor, caracteres);

    return resultado;
}

}  // namespace

extern "C" {

JNIEXPORT jintArray JNICALL
Java_com_notadasi_NotaBuscaRapidaModule_nativeBuscarOcorrencias(
    JNIEnv* env, jobject /*thiz*/, jstring textoCompleto, jstring termoBusca) {
    const std::string texto = jstringParaStdString(env, textoCompleto);
    const std::string termo = jstringParaStdString(env, termoBusca);

    const std::vector<int> ocorrencias = nota_dasi::buscarTextoRapido(texto, termo);

    jintArray resultado = env->NewIntArray(static_cast<jsize>(ocorrencias.size()));
    if (!ocorrencias.empty()) {
        env->SetIntArrayRegion(resultado, 0, static_cast<jsize>(ocorrencias.size()), ocorrencias.data());
    }

    return resultado;
}

JNIEXPORT jstring JNICALL
Java_com_notadasi_NotaBuscaRapidaModule_nativeDescriptografarSimulado(
    JNIEnv* env, jobject /*thiz*/, jstring textoCriptografado) {
    const std::string texto = jstringParaStdString(env, textoCriptografado);
    const std::string textoClaro = nota_dasi::descriptografarTextoSimulado(texto);

    return env->NewStringUTF(textoClaro.c_str());
}

}  // extern "C"

#endif  // __ANDROID__
