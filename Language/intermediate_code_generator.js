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
    Instructions[item.type](item);
  }
}

function intermediate_identifier(item){}
function intermediate_call(item){}
function intermediate_index(item){}
function intermediate_child(item){}
function intermediate_add(item){
  // Generate instructions to put left value on evaluation stack
  generate_intermediate_code(item.left);
  // Generate instructions to put right value on evaluation stack
  generate_intermediate_code(item.right);
  // Push ADD instruction
  intermediateCode.push(["ADD", []]);
}

function intermediate_sub(item){
  // Generate instructions to put left value on evaluation Stack
  generate_intermediate_code(item.left);
  // Place right value on stack
  generate_intermediate_code(item.right);
  // Push SUB instruction
  intermediateCode.push(["SUB", []]);
}

function intermediate_div(item){
  generate_intermediate_code(item.left);
  generate_intermediate_code(item.right);
  intermediateCode.push(["DIV", []]);
}

function intermediate_mult(item){
  generate_intermediate_code(item.left);
  generate_intermediate_code(item.right);
  intermediateCode.push(["MULT", []]);
}

function intermediate_not(item){
  // Not only has a right value
  generate_intermediate_code(item.right);
  intermediateCode.push(["BOOLEANNOT", []]);
}

function intermediate_and(item){
  generate_intermediate_code(item.left);
  generate_intermediate_code(item.right);
  intermediateCode.push(["BOOLEANAND", []]);
}

function intermediate_or(item){
  generate_intermediate_code(item.left);
  generate_intermediate_code(item.right);
  intermediateCode.push(["BOOLEANOR", []]);
}

function intermediate_lesser(item){
  generate_intermediate_code(item.left);
  generate_intermediate_code(item.right);
  intermediateCode.push(["LESSER", []]);
}

function intermediate_greater(item){
  generate_intermediate_code(item.left);
  generate_intermediate_code(item.right);
  intermediateCode.push(["GREATER"], []);
}

function intermediate_lesserequal(item){
  generate_intermediate_code(item.left);
  generate_intermediate_code(item.right);
  intermediateCode.push(["LESSEREQUAL", []]);
}

function intermediate_greaterequal(item){
  generate_intermediate_code(item.left);
  generate_intermediate_code(item.right);
  intermediateCode.push(["GREATEREQUAL", []]);
}

function intermediate_equal(item){
  generate_intermediate_code(item.left);
  generate_intermediate_code(item.right);
  intermediateCode.push(["EQUAL", []]);
}

function intermediate_notequal(item){
  generate_intermediate_code(item.left);
  generate_intermediate_code(item.right);
  intermediateCode.push(["NOTEQUAL", []]);
}

function intermediate_assign(item){
  // Place value on stack
  generate_intermediate_code(item.right);
  // Need to store name on stack
  intermediate_name(item.left);
  intermediateCode.push(["STORE", []]);
}

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
function intermediate_string(item){
  intermediateCode.push(["STRING", [item.value]]);
}

function intermediate_int(item){
  intermediateCode.push(["INT", [item.value]]);
}

function intermediate_float(item){
  intermediateCode.push(["FLOAT", [item.value]]);
}

function intermediate_bool(item){
  intermediateCode.push(["BOOL", [item.value]]);
}

function intermediate_null(item){
  intermediateCode.push(["NULL", []]);
}

function intermediate_name(item){
  // Generate name and store reference to it on the evaluation stack
  intermediateCode.push(["NAME", [item.name]]);
}
