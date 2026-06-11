cmake_minimum_required(VERSION 3.17)

pybind11_add_module(_vector_engine
    pybind_module.cpp
)

target_link_libraries(_vector_engine
    PRIVATE
        vector_engine
        pybind11::module
)

target_include_directories(_vector_engine
    PRIVATE
        ${CMAKE_SOURCE_DIR}/src
        ${CMAKE_SOURCE_DIR}/include
)

# Set the output library name to match the Python module name
set_target_properties(_vector_engine PROPERTIES
    PREFIX ""
    OUTPUT_NAME "_vector_engine"
)

# On Windows, ensure the .pyd extension
if(WIN32)
    set_target_properties(_vector_engine PROPERTIES
        SUFFIX ".pyd"
    )
endif()
