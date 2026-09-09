package com.notadasi

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray

class NotaBuscaRapidaModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "NotaBuscaRapida"

  @ReactMethod
  fun buscarOcorrencias(textoCompleto: String, termoBusca: String, promise: Promise) {
    if (!bibliotecaCarregada) {
      promise.reject(ERRO_BIBLIOTECA_INDISPONIVEL, MENSAGEM_BIBLIOTECA_INDISPONIVEL)
      return
    }

    try {
      val ocorrencias: IntArray = nativeBuscarOcorrencias(textoCompleto, termoBusca)
      val resultado: WritableArray = Arguments.createArray()
      ocorrencias.forEach { resultado.pushInt(it) }
      promise.resolve(resultado)
    } catch (erro: Throwable) {
      promise.reject("ERRO_BUSCA_RAPIDA", erro)
    }
  }

  @ReactMethod
  fun descriptografarSimulado(textoCriptografado: String, promise: Promise) {
    if (!bibliotecaCarregada) {
      promise.reject(ERRO_BIBLIOTECA_INDISPONIVEL, MENSAGEM_BIBLIOTECA_INDISPONIVEL)
      return
    }

    try {
      promise.resolve(nativeDescriptografarSimulado(textoCriptografado))
    } catch (erro: Throwable) {
      promise.reject("ERRO_DESCRIPTOGRAFAR_SIMULADO", erro)
    }
  }

  private external fun nativeBuscarOcorrencias(textoCompleto: String, termoBusca: String): IntArray
  private external fun nativeDescriptografarSimulado(textoCriptografado: String): String

  companion object {
    private const val ERRO_BIBLIOTECA_INDISPONIVEL = "ERRO_BIBLIOTECA_INDISPONIVEL"
    private const val MENSAGEM_BIBLIOTECA_INDISPONIVEL =
        "A biblioteca nativa 'nota_busca_rapida' nao pode ser carregada neste dispositivo."

    // O carregamento nunca deve derrubar o app: se o .so nao estiver empacotado
    // para a ABI do aparelho, o JavaScript cai automaticamente no fallback em JS.
    private val bibliotecaCarregada: Boolean =
        try {
          System.loadLibrary("nota_busca_rapida")
          true
        } catch (erro: Throwable) {
          false
        }
  }
}
