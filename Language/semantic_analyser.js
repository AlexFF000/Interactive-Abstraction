var symbol_table = {"symbols": {}, "sub_scopes": [], "parent": null};
var mainScope = symbol_table;  // Contains reference to the symbol table for the current scope
var mainStartScope = symbol_table;  // Contains reference to most immediate scope (e.g. the most immediate scope for code in an if statement would be the scope of that if statement)
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

function analyse_identifier(tree){  // Prevent an identifier being declared with a name that is already accessible in an accessible scope
  var scope = mainScope;
  var startScope = mainScope;
  var found = false;
  if (identifier_flags["global"] == true){  // If global then move to the global scope
    scope = symbol_table;
    startScope = symbol_table;
  }
  // Check if identifier exists in current scope
  while (scope.symbols[tree.name] == undefined){
    if (scope.parent == null){  // Scope is global
      // Add new symbol, as there is no symbol with that name already
      startScope.symbols[tree.name] = null;
      resetIdentifierFlags();
    }
    else{
      scope = scope.parent;  // Move up to the parent scope, and see if the identifier already exists there
    }
  }
  if (identifier_flags["public"] || identifier_flags["private"] || identifier_flags["static"] || identifier_flags["global"]){
    errors.semantic.nameexists(tree["position"]);
  }

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

function resetIdentifierFlags(){  // Reset identifier flags to false
  identifier_flags["public"] = false;
  identifier_flags["private"] = false;
  identifier_flags["static"] = false;
  identifier_flags["global"] = false;
}
