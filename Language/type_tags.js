/*
    Type tags are numbers representing the type of an object in memory
    They are placed in the first address of objects
*/
const type_tags = {
    "int": 32,
    "float": 33,
    "bool": 34,
    "array": 35,
    "string": 36,
    "function_def": 37,
    "class_def": 38,
    "instance": 39,
    "list": 40,
    "dict": 41,
    "var_table": 42,
    "function_proto_table": 43,
    "class_proto_table": 44,
    "reference": 45,
    "large_obj_reference": 46,
    "permanent_large_obj_reference": 47,
    "var_table_entry": 48,
    "class_proto_entry": 49,
    "func_proto_entry": 50,
    "name_pool": 51,
    "expansion_name_pool": 52,
    "expansion_var_table": 53,
    "expansion_class_table": 54,
    "name": 55,
    "bound_method": 56,
    "list_node": 57
};