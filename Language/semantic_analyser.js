var symbol_table = {};
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
    case ("public" || "private" || "static" || "global"):
      analyse_modifier(tree);
      break;
    case ("function" || "class"):
      analyse_definition(tree);
      break;
    case ("if" || "for" || "while"):
      analyse_block(tree);
      break;
    case ("=" || "==" || "<" || ">" || "<=" || ">=" || "&" || "|" || "+" || "-" || "*" || "/"):
      analyse_operator(tree);
      break;
  }
}
