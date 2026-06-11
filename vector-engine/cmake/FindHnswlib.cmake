# FindHnswlib.cmake
# ------------------
# Locate the hnswlib header-only library.
#
# This module is a fallback for when hnswlib is installed system-wide rather
# than fetched via FetchContent.  It defines:
#
#   Hnswlib_FOUND          - True if headers were found
#   Hnswlib_INCLUDE_DIRS   - Include directories
#   Hnswlib::hnswlib       - Imported INTERFACE target
#
# Hints:
#   HNSWLIB_ROOT           - Preferred installation prefix

find_path(HNSWLIB_INCLUDE_DIR
    NAMES hnswlib/hnswalg.h
    HINTS
        ${HNSWLIB_ROOT}
        ENV HNSWLIB_ROOT
        /usr/local
        /usr
    PATH_SUFFIXES include
)

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(Hnswlib
    REQUIRED_VARS HNSWLIB_INCLUDE_DIR
)

if(Hnswlib_FOUND AND NOT TARGET Hnswlib::hnswlib)
    add_library(Hnswlib::hnswlib INTERFACE IMPORTED)
    set_target_properties(Hnswlib::hnswlib PROPERTIES
        INTERFACE_INCLUDE_DIRECTORIES "${HNSWLIB_INCLUDE_DIR}"
    )
endif()

mark_as_advanced(HNSWLIB_INCLUDE_DIR)
