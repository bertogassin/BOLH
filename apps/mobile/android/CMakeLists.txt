cmake_minimum_required(VERSION 3.10)
project(bolh_jni C)

add_library(bolh_jni SHARED
    ../src/main/cpp/bolh_jni.c
)

find_library(log-lib log)

target_link_libraries(bolh_jni
    PRIVATE
    bolh_core   # expect libbolh_core.so available to linker
    ${log-lib}
)

set_target_properties(bolh_jni PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}
)
