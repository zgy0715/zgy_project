cmake_minimum_required(VERSION 3.17)

# The target must be called something other than "vector_engine" (that name is
# already taken by the static library), but the produced file and the
# PYBIND11_MODULE() name both have to be "vector_engine" so that
# `import vector_engine` works.
pybind11_add_module(vector_engine_python
    pybind_module.cpp
)

target_link_libraries(vector_engine_python
    PRIVATE
        vector_engine
        pybind11::module
)

target_include_directories(vector_engine_python
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/../src
        ${CMAKE_CURRENT_SOURCE_DIR}/../include
)

# Set the output library name to match the Python module name so that the
# artifact is vector_engine.so / vector_engine.pyd (matching PyInit_vector_engine).
set_target_properties(vector_engine_python PROPERTIES
    PREFIX ""
    OUTPUT_NAME "vector_engine"
)

# On Windows, ensure the .pyd extension
if(WIN32)
    set_target_properties(vector_engine_python PROPERTIES
        SUFFIX ".pyd"
    )
endif()
