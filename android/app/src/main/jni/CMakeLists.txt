cmake_minimum_required(VERSION 3.13)

# Nome da biblioteca principal do app: gera a libappmodules.so.
project(appmodules)

# Traz toda a infraestrutura da Nova Arquitetura (TurboModules do core, Fabric, JSI).
# Sem este include, modulos como 'PlatformConstants' nao sao registrados e o app
# abre com tela preta.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Nossa biblioteca C++ de busca rapida (gera a libnota_busca_rapida.so).
# O caminho sobe de android/app/src/main/jni ate a raiz do projeto.
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../../../../../cpp nota_dasi)
