cmake_minimum_required(VERSION 3.18)

project(nota_dasi LANGUAGES CXX)

add_library(nota_busca_rapida SHARED
    nota_busca_rapida.cpp
    jni_bridge.cpp
)

target_compile_features(nota_busca_rapida PRIVATE cxx_std_17)

target_include_directories(nota_busca_rapida
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
)

set_target_properties(nota_busca_rapida PROPERTIES
    POSITION_INDEPENDENT_CODE ON
)
