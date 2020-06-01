var symbol_table = {};
var scope = symbol_table;  // Contains reference to the symbol table for the current scope
var startScope = symbol_table;  // Contains reference to most immediate scope (e.g. the most immediate scope for code in an if statement would be the scope of that if statement)
var identifier_flags = {
  "public": false,
"private": false,
"static": false,
"global": false
};  // Flags for use when analysing identifiers

function semantic_analyser(tree){
  // Traverse through syntax trees, calling correct semantic anlaysis function for each
  if (getObjectType(tree) == "array"){  // If an array of trees, iterate through and call analyser on each
    for (var i = 0; i < tree.length; i++){
      analyse_tree(tree[i]);
    }
  }
  else{
    analyse_tree(tree);
  }
}

function analyse_tree(tree){
  switch (tree["type"]){
    case "identifier":
      analyse_identifier(tree);
      break;
    case "public":
    case "private":
    case "static":
    case "global":
      analyse_modifier(tree);
      break;
    case "function":
    case "class":
      analyse_definition(tree);
      break;
    case "if":
    case "for":
    case "foreach":
    case "while":
      analyse_block(tree);
      break;
    case "=":
    case "==":
    case "<":
    case ">":
    case "<=":
    case ">=":
    case "&":
    case "|":
    case "+":
    case "-":
    case "*":
    case "/":
      analyse_operator(tree);
      break;
  }
}

function analyse_identifier(tree){
  
}

function analyse_modifier(tree){
  console.log("analyse_modifier");
}

function analyse_definition(tree){
  console.log("analyse_definition");
}

function analyse_block(tree){
  console.log("analyse_block");
}

function analyse_operator(tree){
  console.log("analyse_operator");
}
