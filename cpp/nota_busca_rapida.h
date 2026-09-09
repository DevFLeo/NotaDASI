#pragma once

#include <string>
#include <vector>

namespace nota_dasi {

std::string normalizarTexto(const std::string& texto);
std::vector<int> buscarTextoRapido(const std::string& textoCompleto, const std::string& termoBusca);
std::string descriptografarTextoSimulado(const std::string& textoCriptografado);

}  // namespace nota_dasi

#if defined(__ANDROID__)

#include <jni.h>

extern "C" {

JNIEXPORT jintArray JNICALL
Java_com_notadasi_NotaBuscaRapidaModule_nativeBuscarOcorrencias(
    JNIEnv* env, jobject thiz, jstring textoCompleto, jstring termoBusca);

JNIEXPORT jstring JNICALL
Java_com_notadasi_NotaBuscaRapidaModule_nativeDescriptografarSimulado(
    JNIEnv* env, jobject thiz, jstring textoCriptografado);

}  // extern "C"

#endif  // __ANDROID__
