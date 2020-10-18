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
  "-": intermediate_sub,
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
  if (getObjectType(tree) == "object"){
    // The tree is a single syntax tree
    Instructions[tree.type](tree);
  }
  else{
    // The "tree" is a list of syntax trees
    while (tree.length > 0){
      item = tree.shift();
      Instructions[item.type](item);
    }
  }
}

function return_intermediate_code(tree){
  // generate_intermediate_code but return the code instead of adding it to intermediateCode list
  generatedCode = [];
  tmpIntermediateCode = intermediateCode;
  intermediateCode = generatedCode;
  generate_intermediate_code(tree);
  intermediateCode = tmpIntermediateCode;
  return generatedCode;
}

function intermediate_identifier(item){
  // Declare a variable
  // Place name on top of stack
  intermediate_name(item);
  intermediateCode.push(["LOAD", []]);
}

function intermediate_call(item){
  // The args must be loaded in reverse, so that the first arg will be on top of the stack
  // The args will be converted to intermediate instructions, but will be given as an argument to PREPARECALL instead of being inserted into intermediateCode directly
  args = return_intermediate_code(item.args.reverse());
  argsCount = args.length;
  intermediateCode.push(["PREPARECALL", [args, argsCount]]);
}

function intermediate_index(item){
  // First load the object being indexed onto the eval stack
  generate_intermediate_code(item.name);
  // Then place the index on top of eval stack
  generate_intermediate_code(item.index);
  // Then use LOADINDEX instruction
  intermediateCode.push(["LOADINDEX", []]);
}

function intermediate_index_store(item){
  // A different instruction must be used if storing into an index than for loading from an index
  // The object to be stored will already be on the eval stack
  // Place the object being indexed onto stack
  generate_intermediate_code(item.name);
  // Place index on top of stack
  generate_intermediate_code(item.index);
  intermediateCode.push(["STOREINDEX", []]);
}

function intermediate_child(item){
  // First place parent object on eval stack
  generate_intermediate_code(item.parent);
  intermediateCode.push(["CHILD", []]);  // The child instruction tells the program to get the next requested object ("the child") from the object on top of the stack ("the parent") instead of from the variable table
  // Then code to get child object
  generate_intermediate_code(item.name);
}

function intermediate_child_store(item){
  // A different instruction must be used if storing into child object than for loading from one
  // Place parent on eval stack as normal
  generate_intermediate_code(item.parent);
  intermediateCode.push(["CHILD", []]);
  // Instead of loading the value at the child name onto stack, simply load the name
  intermediate_name(item.name);
  intermediateCode.push(["STORE", []]);
}

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
  // The following code will be different if the object being loaded into is an index or a child of another object
  if (item.left.type == "index"){
    intermediate_index_store(item.left);
  }
  else if (item.left.type == "child"){
    intermediate_child_store(item.left);
  }
  else
  {
    // Need to store name on stack
    intermediate_name(item.left);
    intermediateCode.push(["STORE", []]);
}
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
function intermediate_global(item){
  intermediateCode.push(["GLOBAL", []]);
  generate_intermediate_code(item.identifier);
}
function intermediate_as(item){}
function intermediate_modifier(item){
  switch(item.modifier){
    case "static":
      intermediateCode.push(["STATIC", []]);
      break;
    case "private":
      intermediateCode.push(["PRIVATE", []]);
      break;
    case "public":
      intermediateCode.push(["PUBLIC", []]);
      break;
  }
  generate_intermediate_code(item.subject);
}
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
