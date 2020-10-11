// Scan syntaxTree and generate intermediate instructions
intermediateCode = [];
/*
Intermediate instructions will be stored in the following format: [instruction name, [arguments]]
*/
var Instructions = {
  "identifier": intermediate_identifier,
  "call": intermediate_call,
  "index": intermediate_index,
  "child": intermediate_child,
  "+": intermediate_add,
  "-": intermdiate_sub,
  "/": intermediate_div,
  "*": intermediate_mult,
  "!": intermediate_not,
  "&": intermediate_and,
  "|": intermediate_or,
  "<": intermediate_lesser,
  ">": intermediate_greater,
  "<=": intermediate_lesserequal,
  ">=": intermediate_greaterequal,
  "==": intermediate_equal,
  "!=": intermediate_notequal,
  "=": intermediate_assign,
  "class": intermediate_classdef,
  "function": intermediate_functiondef,
  "while": intermediate_while,
  "foreach": intermediate_foreach,
  "for": intermediate_for,
  "if": intermediate_if,
  "else if": intermediate_else_if,
  "else": intermediate_else,
  "import": intermediate_import,
  "return": intermediate_return,
  "reference": intermediate_reference,
  "dereference": intermediate_dereference,
  "address": intermediate_address,
  "global": intermediate_global,
  "as": intermediate_as,
  "modifier": intermediate_modifier,
  "throw": intermediate_throw,
  "try": intermediate_try,
  "catch": intermediate_catch,
  "finally": intermediate_finally,
  "list": intermediate_list,
  "dict": intermediate_dict,
  "string": intermediate_string,
  "number": intermediate_int,
  "float": intermediate_float,
  "bool": intermediate_bool,
  "null": intermediate_null
}

function generate_intermediate_code(tree){
  intermediateCode.push(["SETUP", []])
  while (tree.length > 0){
    item = tree.shift();

  }
}

function intermediate_identifier(item){}
function intermediate_call(item){}
function intermediate_index(item){}
function intermediate_child(item){}
function intermediate_add(item){}
function intermediate_sub(item){}
function intermediate_div(item){}
function intermediate_mult(item){}
function intermediate_not(item){}
function intermediate_and(item){}
function intermediate_or(item){}
function intermediate_lesser(item){}
function intermediate_greater(item){}
function intermediate_lesserequal(item){}
function intermediate_greaterequal(item){}
function intermediate_equal(item){}
function intermediate_notequal(item){}
function intermediate_assign(item){}
function intermediate_classdef(item){}
function intermediate_functiondef(item){}
function intermediate_while(item){}
function intermediate_foreach(item){}
function intermediate_for(item){}
function intermediate_if(item){}
function intermediate_else_if(item){}
function intermediate_else(item){}
function intermediate_import(item){}
function intermediate_return(item){}
function intermediate_reference(item){}
function intermediate_dereference(item){}
function intermediate_address(item){}
function intermediate_global(item){}
function intermediate_as(item){}
function intermediate_modifier(item){}
function intermediate_throw(item){}
function intermediate_try(item){}
function intermediate_catch(item){}
function intermediate_finally(item){}
function intermediate_list(item){}
function intermediate_dict(item){}
function intermediate_string(item){}
function intermediate_int(item){}
function intermediate_float(item){}
function intermediate_bool(item){}
function intermediate_null(item){}
