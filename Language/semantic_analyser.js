var expression_rules = {"+": [{"left": ["identifier", "call", "index", "child", "number", "float"], "right": ["identifier", "call", "index", "child", "number", "float"]}, {"left": ["identifier", "call", "index", "child", "string"], "right": ["identifier", "call", "index", "child", "string"]}],
"-": [{"left": ["identifier", "call", "index", "child", "number", "float"], "right": ["identifier", "call",  "index", "child", "number", "float"]}],
"*": [{"left": ["identifier", "call", "index", "child", "number", "float"], "right": ["identifier", "call", "index", "child", "number", "float"]}],
"/": [{"left": ["identifier", "call", "index", "child", "number", "float"], "right": ["identifier", "call", "index", "child", "number", "float"]}],
">": [{"left": ["identifier", "call", "index", "child", "number", "float"], "right": ["identifier", "call", "index", "child", "number", "float"]}],
"<": [{"left": ["identifier", "call", "index", "child", "number", "float"], "right": ["identifier", "call", "index", "child", "number", "float"]}],
">=": [{"left": ["identifier", "call", "index", "child", "number", "float"], "right": ["identifier", "call", "index", "child", "number", "float"]}],
"<=": [{"left": ["identifier", "call", "index", "child", "number", "float"], "right": ["identifier", "call", "index", "child", "number", "float"]}],
"==": [{"left": ["identifier", "call", "index", "child", "number", "float", "bool"], "right": ["identifier", "call", "index", "child", "number", "float", "bool"]}],
"|": [{"left": ["identifier", "call", "index", "child", "bool"], "right": ["identifier", "call", "index", "child", "bool"]}],
"&": [{"left": ["identifier", "call", "index", "child", "bool"], "right": ["identifier", "call", "index", "child", "bool"]}],
"!": [{"right": ["identifier", "call", "index", "child", "bool"]}],
"=": [{"left": ["identifier", "index", "call", "child"], "right": ["identifier", "index", "call", "child", "string", "number", "float", "bool"]}]
};


var symbol_table = {"symbols": {}, "sub_scopes": [], "parent": null};
var mainScope = symbol_table;  // Contains reference to the symbol table for the current scope
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
    case "modifier":
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
    case "!":
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
      startScope.symbols[tree.name] = true;
      resetIdentifierFlags();
      break;
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
  var next;
  // Set correct flag
  if (tree.type == "global"){
    identifier_flags["global"] = true;
    next = tree.identifier;
  }
  else{
  switch (tree.modifier){
    case "public":
      identifier_flags["public"] = true;
      break;
    case "private":
      identifier_flags["private"] = true;
      break;
    case "static":
      identifier_flags["static"] = true;
      break;
  }
  next = tree.subject;
}
//  Analyse the subtree that the keyword applies to
  semantic_analyser(next);
}

function analyse_definition(tree){
  // First analyse name of function / class
  semantic_analyser(tree.name);
  // Then create new scope
  // Keep a reference to the current scope to go back to it once the definition has been analysed
  var currentScope = mainScope;
  // Create a new scope for this definition
  mainScope.sub_scopes.push(create_new_scope());
  // Make the new scope the one currently in use
  mainScope = mainScope.sub_scopes[mainScope.sub_scopes.length - 1];
  // Analyse the code inside the definition
  semantic_analyser(tree.code);
  // Finally, return to previous scope
  mainScope = currentScope;
}

function analyse_block(tree){
  // Create new scope
  var currentScope = mainScope;
  mainScope.sub_scopes.push(create_new_scope());
  mainScope = mainScope.sub_scopes[mainScope.sub_scopes.length - 1];
  // Analyse the code in the block
  semantic_analyser(tree.code);
  mainScope = currentScope;
}

function analyse_operator(tree){
  // Make sure both sides are analysed first
  if (tree.type == "!" && !isType(tree.right)){
    semantic_analyser(tree.right);
  }
  else if (!(isType(tree.left) && isType(tree.right))){
    if (!isType(tree.left)){
      semantic_analyser(tree.left);
    }
    if (!isType(tree.right)){
      semantic_analyser(tree.right);
    }
  }
  else{
    expressionMatchesRule(tree);
  }
}

function expressionMatchesRule(tree){  // Check if the expression meets the type rules
  var rules = expression_rules[tree.type];  // The rules for the operator
  var rulesMet = false;
  for (var possibility in rules){  // A rule may contain multiple possibilities, only one possibility needs to be met
    if (arrayContains(rules[possibility]["right"], tree.right.type)){
      if (rules[possibility]["left"] == undefined || arrayContains(rules[possibility]["left"], tree.left.type)){
        rulesMet = true;
        break;
      }
    }
  }
  if (rulesMet == false){
    errors.semantic.invalidoperand(tree, tree.position);
  }
}

function resetIdentifierFlags(){  // Reset identifier flags to false
  identifier_flags["public"] = false;
  identifier_flags["private"] = false;
  identifier_flags["static"] = false;
  identifier_flags["global"] = false;
}

function create_new_scope(){
  // Parent is the scope of which this new scope is a sub_scope, therefore the scope currenly in mainScope
  return {"symbols": {}, "sub_scopes": [], "parent": mainScope};
}

function isType(tree){  // Return true if the tree type is a type (i.e. a literal or identifier)
  switch (tree.type){
    case "identifier":
    case "call":
    case "index":
    case "child":
    case "string":
    case "number":
    case "float":
    case "bool":
      return true;
    default:
      return false;
  }
}

function arrayContains(arrayToSearch, query){  // Return true if given item is in array, false otherwise
  for (var i in arrayToSearch){
    if (arrayToSearch[i] == query){
      return true;
    }
  }
  return false;
}
