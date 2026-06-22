import importlib.util
import os
import sys
from pydoc import locate


def get_module_from_full_path(module_path):
    module_name = os.path.basename(module_path).split(".")[0]
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)

    return module


def get_class_from_full_path(class_path):
    return locate(class_path)
