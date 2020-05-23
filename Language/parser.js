var syntaxTree = [];  // index: [item, parent];
var treeIndexes = 0;
var parserStack = []  // Stack of parser functions for debugging purposes
var parsers = {"identifier": parse_identifier, "keyword": parse_keyword, "operator": parse_operator, "string": parse_literal, "number": parse_literal, "float": parse_literal, "bool": parse_literal, "separator": parse_separator};
function addToTree(item, parent){
  treeIndexes++;  // Increment to create a new index for the new node
  syntaxTree[treeIndexes] = [item, parent];
  treeStack.push(treeIndexes);
}


var expectedStack = [];  // Stack containing tokens that are expected.  Format: [[[token type, value], [Multiple can be specified]], needed immediately (true or false)]  // Needed immediately specifies whether the expected token needs to be the next character
var tokenPos;  // Will hold the position of the token in the original input

function isExpected(token, tokenPos){  // Check if token is a top of expectedStack
  var expected = expectedStack[expectedStack.length -1];  // Get expected token
  var found = false;
  for (var i = 0; i < expected[0].length; i++){
    if (token[0] == expected[0][i][0]){
      if (expected[0][i][1] !== null){  // The value of the token must also match
        if (token[1] == expected[0][i][1]){  //  Value matches
          found = true;
          break;
        }
      }
      else{
        found = true;
        break;
      }
    }
  }
  if (found === true){  // The expected token was found
    expectedStack.pop();  // Remove from expected stack
  }
  else{
    if (expected[1] === true){  // The expected token was wanted immediately, but not found
      errors.syntax.unexpected(expectedMessage(expected), token[1], tokenPos);
    }
  }
}


function parse_program(){  // Parse program from top level
  while (identifiedTokens.length > 0){
    parserStack.push("parse_program");
    var token = identifiedTokens.shift()  // Get next token
    if (token[0] == "keyword"){
      syntaxTree.push(parse_keyword(token));
    }
    else if (token[0] == "identifier"){
      syntaxTree.push(parse_identifier(token));
    }
    else if (token[0] == "number" || token[0] == "float" || token[0] == "string"){
      syntaxTree.push(parse_expression(token));
    }
    else if (token[0] == "bool"){
      syntaxTree.push(parse_literal(token));
    }
    else if (token[0] == "operator"){  // Numbers may begin with +/- to denote whether they are positive or negative, or the ! operator
      syntaxTree.push(parse_operator(token));
    }
    else if (token[0] == "separator"){
      syntaxTree.push(parse_separator(token));
    }
}
}

function parse_keyword(token){
  parserStack.push("parse_keyword");
  if (token[1] == "class"){
    return parse_class(token);
  }
  else if (token[1] == "for"){
    return parse_for(token);
  }
  else if (token[1] == "while"){
    return parse_while(token);
  }
  else if (token[1] == "function"){
    return parse_function(token);
  }
  else if (token[1] == "global"){
    return parse_global(token);
  }
  else if (token[1] == "if"){
    return parse_if(token);
  }
  else if (token[1] == "import"){
    return parse_import(token);
  }
  else if (token[1] == "return"){
    return parse_return(token);
  }
  else if (token[1] == "reference"){
    return parse_reference(token);
  }
}

function parse_identifier(token){
  parserStack.push("parse_identifier")
  var tree = {"type": "identifier", "name": token[1]};
  var next = identifiedTokens[0];  // Get next token without removing it
  if (next == undefined){
    return tree;
  }
  if (next[0] == "operator"){  // An assignment or expression
    return parse_expression(tree);
  }
  while (next[1] == "("){  // A function call
    identifiedTokens.shift()  // Remove next token from list
    var args = parse_args();
    tree = {"type": "call", "name": tree, "args": args};
    // Check if the function call is part of an expression
    next = identifiedTokens[0];
    if (next == undefined){
      return tree;
    }
    if (next[0] == "operator"){
      return parse_expression(tree);
    }
  }
  while (next[1] == "["){  // A reference to an item in a list or dictionary
    identifiedTokens.shift();  // Remove next from list
    var index = parse_index();

    tree = {"type": "index", "name": tree, "index": index};
    next = identifiedTokens[0];
    if (next == undefined){
      return tree;
    }

    while (next[1] == "("){  // A function call e.g. example[0](foo)
      identifiedTokens.shift();  // Remove first ( from tokens
      var args = parse_args();
      tree = {"type": "call", "name": tree, "args": args};
      next = identifiedTokens[0];
      if (next == undefined){
        return tree;
      }
    }
    if (next != undefined && next[0] == "operator"){  // If followed by an operator, must be part of an expression
      return parse_expression(tree);
    }

  }
  return tree;
}

function parse_definition_identifier(token){  // For parsing identifiers used in function and class definitions
  parserStack.push("parse_definition_identifier");
  return {"type": "identifier", "name": token[1]};
}

function parse_expression(token, left){
  parserStack.push("parse_expression");
    //  Get all the tokens that make up the expression
    var expression_tokens = [];
    var extended_identifiers = [];  // List for identifiers that point to an index in a list or dict e.g. example[0]
    var end = false;
    var open_brackets = 0;  // Records the number of brackets currently open, this is needed to know when to remove extra close brackets which are left at the end of an expression by parse_if.
    if (left != undefined){  // If both token and left have been provided, then token is an operator and left will be the tokens on the left of it
      if (getObjectType(left) == "object"){  // The token(s) on the left  of the operator have already been parsed into syntax tree format
        // Store tree in extended identifiers
        extended_identifiers.push(left);
        // Put reference to tree in expression_tokens
        expression_tokens.push(["identifier", 2, 0]);
      }
      else{
        expression_tokens.push(left);  // If it is a normal token (has not already been parsed) then put it at the start of expression_tokens
      }
    }
    if (token != undefined){  // The first token has been provided as an argument to the function
      if (getObjectType(token) == "object"){  // If the first "token" is a syntax tree, meaning it has already been parsed (e.g. when the expression starts with a function call or list index)
        // Store tree in extended_identifiers
        extended_identifiers.push(token);
        // Put reference to tree in expression_tokens
        expression_tokens.push(["identifier", 2, extended_identifiers.length - 1]);  // A 2 in place of the normal name string indicates that this token is a reference to an extended_identifier  (2 is used instead of 0 or 1 to avoid possible type conversion causing identifier names such as true or false being identified as equivalent to 0 or 1)
      }
      else{
        expression_tokens.push(token);
        if (token[1] == "("){
          open_brackets++;
        }
    }
    }

    var next = null;
    while (end === false){
      next = identifiedTokens.shift();
      if (next == undefined){  // identifiedTokens ends too early to create valid expression
        if (expression_tokens.length == 1 && isConstant(expression_tokens[0])){  // If a single literal has been passed to parse_expression and is the last token
          return parsers[expression_tokens[0][0]](expression_tokens[0]);
        }
        errors.syntax.incomplete();
      }
      expression_tokens.push(next);
      if (next[0] == "identifier" || isConstant(next) || next[1] == ")"){
        if (next[0] == "identifier"){
          if (identifiedTokens[0] != undefined && (identifiedTokens[0][1] == "[" || identifiedTokens[0][1] == "{" || identifiedTokens[0][1] == "(")){
            var identifier_tokens = [next];  // The token containing the identifier
          while (identifiedTokens[0] != undefined && (identifiedTokens[0][1] == "[" || identifiedTokens[0][1] == "{" || identifiedTokens[0][1] == "(")){  // If identifier is followed by [, (, or { it must be a function call or point to a list or dictionary
            var open_token = identifiedTokens[0][1];
            var close_token = null;
            switch (identifiedTokens[0][1]){  // Get correct closure symbol
              case "[":
              close_token = "]";
              break;

              case "{":
              close_token = "}";
              break;

              case "(":
              close_token = ")";
            }
            var open_tokens = 1;  // Record any other instances of the open_token to avoid closing early when a close token is found
            identifier_tokens.push(identifiedTokens.shift());  // Remove the open bracket from identifiedTokens and add it to identifier_tokens
            while (open_tokens > 0){  // Keep taking tokens until the closure is found
              if (identifiedTokens[0] == undefined){
                errors.syntax.incomplete();
              }
              if (identifiedTokens[0][1] == open_token){
                open_tokens++;
              }
              else if (identifiedTokens[0][1] == close_token){
                open_tokens--;
              }
              identifier_tokens.push(identifiedTokens.shift());
            }
          }
            //identifier_tokens.push(identifiedTokens.shift());
            extended_identifiers.push(identifier_tokens);
            expression_tokens.pop();  // Remove identifier token from expression_tokens
            expression_tokens.push(["identifier", 2, extended_identifiers.length - 1]);  // And replace it with a reference to the extended_identifiers list
          }
        }
        else if (next[1] == ")"){
          open_brackets--;  // A close bracket has been found, so the most recently opened brackets are now closed
        }

        if (identifiedTokens[0] == undefined || !(identifiedTokens[0][0] == "operator" || identifiedTokens[0][1] == ")")){  // Peek at following token to see if it is an operator or close bracket (or if there is no following token)
          end = true;  // An identifier, constant, or close bracket not followed by an operator or close bracket must be the last token in the expression
        }
      }
      else if (next[0] == "operator"){  // Check if the operator is a multi token operator (such as ==) as this is not done by the lexer
        var multi_char_operator = multi_token_operator(next);
        valid_consecutive_tokens(next);  // Checks if the operator is followed by a suitable type of token, and throws an error otherwise
        if (multi_char_operator[0] == true){
          expression_tokens[expression_tokens.length - 1] = multi_char_operator[1];  // If it is a multi token operator, then modify the token that has just been added to expression_tokens
        }
        else if (identifiedTokens[0][1] == "+" || identifiedTokens[0][1] == "-"){  // Identify positive and negative numbers
          if (identifiedTokens[1][0] == "number" || identifiedTokens[1][0] == "float"){
            if (identifiedTokens[0][1] == "-"){
              identifiedTokens[1][1] = "-" + identifiedTokens[1][1];  // Add minus symbol to front of number in token to show that it is negative
            }
            // A + symbol does not need to be added as numbers are assumed to be positive anyway
            identifiedTokens.shift();  // Remove the +/- operator to avoid it being processed twice
          }
        }
      }
      else if (next[1] == "("){
        open_brackets++;  // A new set of brackets has been opened
      }
      else if (next[1] == "[" || next[1] == "{"){  // [ or { without an identifier must be the start of a list or dictionary
        var structure_tokens = [next];
        var first_token = true;  // True if this is the first token in a list or dict (i.e. the [ or { that marks the start of it)
        while (first_token || identifiedTokens[0] != undefined && (identifiedTokens[0][1] == "[" || identifiedTokens[0][1] == "{" || identifiedTokens[0][1] == "(")){
          if (first_token){
            var open_token = next[1];
          }
          else{
            var open_token = identifiedTokens[0][1];  // Symbol that opened the structure ([, or {)
          }
          var close_token = null;
          switch (open_token){
            case "[":
            close_token = "]";
            break;

            case "{":
            close_token = "}";
            break;

            case "(":
            close_token = ")";
            break;
            }
            var open_tokens = 1;
            if (first_token == false){  // Only add the token to structure_tokens if it is not the first, as otherwise it will have been added already and also will no longer be in identifiedTokens
              structure_tokens.push(identifiedTokens.shift());
            }
            while (open_tokens > 0){
              if (identifiedTokens[0] == undefined){
                errors.syntax.incomplete();
              }
              if (identifiedTokens[0][1] == open_token){
                open_tokens++;
              }
              else if (identifiedTokens[0][1] == close_token){
                open_tokens--;
              }
              structure_tokens.push(identifiedTokens.shift());
            }
            first_token = false;
        }
        extended_identifiers.push(structure_tokens);
        expression_tokens.pop();  // Remove first token of list / dict from expression_tokens
        expression_tokens.push(["separator", 2, extended_identifiers.length - 1]);

        if (identifiedTokens[0] == undefined || !(identifiedTokens[0][1] == "operator" || identifiedTokens[0][1] == ")")){
          end = true;  // If there is no next token, or the next token is not an operator or close bracket, then this must be the end of the expression
        }
      }
      else if (next[0] == "keyword"){  // For parts of expressions preceded by keywords
        if (next[1] == "reference"){
          let reference_tokens = [next, identifiedTokens.shift()];
          while (identifiedTokens[0] != undefined && identifiedTokens[0][1] == "["){
            reference_tokens.push(identifiedTokens.shift());
            reference_tokens = reference_tokens.concat(getTokenSublist("[", "]"));
            reference_tokens.push(["separator", "]"]);
          }
          extended_identifiers.push(sub_parser(reference_tokens)[0]);  // Sub parser must be used rather than simply calling parse_reference, as otherwise the identifier will be parsed as an expression
          expression_tokens.pop();  // Replace with extended identifier reference
          expression_tokens.push(["identifier", 2, extended_identifiers.length - 1]);
        }
        if (identifiedTokens[0] == undefined || !(identifiedTokens[0][1] == "operator" || identifiedTokens[0][1] == ")")){
          end = true;
        }
      }
    }
    if (expression_tokens[expression_tokens.length - 1][1] == ")" && open_brackets < 0){  // The final token is a close bracket that does not have a corrosponding open bracket, this can happen with parse_if.
      expression_tokens.pop();  // Remove the extra bracket to prevent an error
    }
    // Convert expression to postfix notation and translate to AST
    return parse_postfix(postfix(expression_tokens, extended_identifiers));

}

function postfix(tokens, extended_identifiers){  // Convert to postfix notation using Dijkstra's shunting yard algorithm
  parserStack.push("postfix");
  var output = [];  // Output expression
  var operator_stack = [];
  var token = null;
  while (tokens.length > 0){
    token = tokens.shift();  // Get next token from input
    if (token[0] == "identifier" || isConstant(token)){
      if (token[1] === 2){  // An "extended" identifier, such as a list index (indicated by 2 in position 1)
        token = extended_identifiers[token[2]];  // Replace single token with the list of tokens that comprise the identifier
      }
      output.push(token);  // If an identifier or contant, the token gets pushed onto the output
    }
    else if (token[0] == "separator" && token[1] === 2){  // Extended token containing list or dict
      token = extended_identifiers[token[2]];
      output.push(token);
    }
    else if (token[0] == "operator"){  // The token gets added to the operator stack
      if (operator_stack.length > 0){
        while (operator_stack.length > 0 && [operator_stack.length - 1][1] != "(" && operator_precedence[token[1]] <= operator_precedence[operator_stack[operator_stack.length - 1][1]]){
          output.push(operator_stack.pop());  // If the token at the top of the stack is not ( and has higher or equal precedence than the new token, then remove the top token and add it to the output
        }
        operator_stack.push(token);  // Push new operator to the operator stack
      }
      else{
        operator_stack.push(token);  // Push new operator to the operator stack
      }
    }
    else if (token[1] == "("){
      operator_stack.push(token);
    }
    else if (token[1] == ")"){
      while (operator_stack.length > 0 && operator_stack[operator_stack.length - 1][1] != "("){
        output.push(operator_stack.pop());  // Move the operators on the operator stack into the output until open bracket is found
      }
      if (operator_stack.length <= 0){  // There is no corrosponding open bracket, meaning the expression is invalid
        errors.syntax.invalidexpression.unmatchedparantheses(token[2]);
      }
      else if (operator_stack[operator_stack.length - 1][1] == "("){  // Bracket has been found
        operator_stack.pop();  // Remove open bracket from operator stack, but do not add it to output
      }

    }
  }
  while (operator_stack.length > 0){  // If there are still tokens left in operator stack at end of main loop then add them to the end of output
    output.push(operator_stack.pop());
  }
  return output;
}

function parse_postfix(expression){  // Parse the postfix expression into the AST
  if (expression.length == 1){  // If expression is a single value such as true
    return parsers[expression[0][0]](expression[0]);
  }
  while (containsTokens(expression)){  // Loop until there are no more un-processed tokens in the array
    var index = expression.length - 1;
    while (!(expression[index][1] == "!" && expression[index - 1][0] != "operator" || expression[index][0] == "operator" && expression[index - 1][0] != "operator" && expression[index - 2][0] != "operator")){
      index--;  // Reduce index until an operator is found that follows two values
      if (index < 0){  // There is still at least 1 unprocessed token left, but no expression can be made from it/them, so the expression is invalid
        index = expression.length - 1;
        for (var i in expression){  // Find a token to get a position for the error message
          if (getObjectType(expression[index]) == "array"){
            errors.syntax.invalidexpression.unusabletokens(expression[index][2]);
          }
        }
      }
    }
    var operator = expression[index][1]
    if (operator != "!"){  // Not operator does not have a left value
      var left = expression[index - 2];
      if (getObjectType(left) == "array"){  // If value is not in an array then it must have already been parsed, so should not be parsed again
        if (getObjectType(left[0]) == "array"){  // If the first item in the token array is itself an array, then the "token" must actually be a list of tokens from an extended identifier, which will need to be parsed separately
          left = sub_parser(left)[0];  // Parse the tokens in left separately to produce a parse tree
        }
        else{
        left = parsers[left[0]](left);
      }
      }
    }
    var right = expression[index - 1];
    if (getObjectType(right) == "array"){
      if (getObjectType(right[0]) == "array"){
        right = sub_parser(right)[0];
      }
      else{
      right = parsers[right[0]](right);
    }
    }
    if (operator == "!"){
      expression[index] = {"type": operator, "right": right};  // Not operator only has a right value
      var remove_quantity = 1;  // Number of preceding items to remove from expression
    }
    else{
      expression[index] = {"type": operator, "left": left, "right": right};  // Replace tokens with part of a parse tree
      var remove_quantity = 2;
    }
    expression.splice(index - remove_quantity, remove_quantity);  // Remove the two values from the array to avoid them being processed again
  }
  return expression[0];  // At the end of the loop the only item left in the array will be the syntax tree for the expression
}

function parse_args(){
  parserStack.push("parse_args");
  //  Get all tokens in the arguments, so that sub_parser can be used
  var all_args = [];
  var arg_tokens = [];  // Tokens belonging to each argument
  var open_brackets = 1;
  while (open_brackets > 0){
    if (identifiedTokens[0] == undefined){
      errors.syntax.incomplete();
    }
    if (identifiedTokens[0][1] == "("){
      open_brackets++;
    }
    else if (identifiedTokens[0][1] == ")"){
      open_brackets--;
    }
    if (open_brackets == 1 && identifiedTokens[0][1] == ","){  // If this is not inside sub brackets and the token is a comma, then it marks the end of one argument and beginning of another
      all_args.push(arg_tokens);
      arg_tokens = [];  // Clear arg_tokens ready for next argument
    }
    if (open_brackets == 0 || (open_brackets == 1 && identifiedTokens[0][1] == ",")){  // Commas separating the args are not kept, and neither is the final close bracket
      identifiedTokens.shift();
    }
    else{
      arg_tokens.push(identifiedTokens.shift());
    }
  }
  if (arg_tokens.length > 0){
    all_args.push(arg_tokens);  // Push the tokens from the final argument to all_args
  }
  // Parse the collected tokens using parse args
  var args = [];  // Contains the parse trees for each argument
  for (let i = 0; i < all_args.length; i++){
    // Use sub_parser to parse the argument
    args.push(sub_parser(all_args[i])[0]);
  }
  return args;

/*
  var args = {};
  var argscount = 0;  // Number of arguments supplied
  var end = false;
  var argument = {};
  while (end == false){
    let token = identifiedTokens.shift()  // Get next token
    if (token[1] == ")"){  // End of args
      args[argscount] = argument;  // Add final argument to args
      end = true;
      break;
    }
    else if (token[1] == ","){  // End of one argument, but another has been supplied
      args[argscount] = argument;  // Add argument to args
      argscount++;  // Increment argscount
      argument = {};  // Clear argument ready for next argument
      //break;
    }
    if (isConstant(token) && identifiedTokens[0] != undefined && identifiedTokens[0][0] == "operator"){
      argument = parse_expression(token);  // If the token is a literal type, and is followed by an operator then send it to parse_expression directly (as parse_literal will not check for an operator after so only the first token of the expression will be parsed)
    }
    else{
      argument = parsers[token[0]](token);
  }
  }
  return args;
  */
}

function parse_operator(token, left){
  parserStack.push("parse_operator");
  if (!(token[1] == "!" || token[1] == "+" || token[1] == "-") && left == undefined){
    // Raise error if no left value has been provided, unless the token is a unary operator
    errors.syntax.invalidexpression.noleftoperand(token[2]);
  }
  if (token[1] == "="){
    var next = identifiedTokens[0]; // Get next token
    if (next[1] == "="){ // Two equals (==) is equality operator, one equals is assignment operator
      identifiedTokens.shift();
      return parse_expression(["operator", "=="], left);
    }
    else {
      return parse_expression(["operator", "="], left);
    }
  }
  else if (token[1] == "<"){  // Less than operator
    var next = identifiedTokens[0];
    if (next[1] == "="){
      identifiedTokens.shift();  // Remove = token as it has already been processed
      return parse_expression(["operator", "<="], left);
    }
    else {
      return parse_expression(["operator", "<"], left);
    }
  }
  else if (token[1] == ">"){  // Greater than operator
    var next = identifiedTokens[0];
    if (next[1] == "="){
      identifiedTokens.shift();  // Remove = token as it has already been processed
      return parse_expression(["operator", ">="], left);
    }
    else {
      return parse_expression(["operator", ">"], left);
    }
  }
  else if (token[1] == "!"){  // Not operator
    var next = identifiedTokens[0];
    if (next[1] == "="){  // ! followed by equals is the not equal operator
      identifiedTokens.shift();  // Remove = from tokens list as it has already been processed
      if (left == undefined){
        // != operator cannot be used without a left operand, so throw error
        errors.syntax.invalidexpression.noleftoperand(token[2]);
      }
      return parse_expression(["operator", "!="], left);
    }
    else {
      return parse_expression(token);
    }
  }
  else if (token[1] == "-" || token[1] == "+"){  // Negative or positive numbers
    var next = identifiedTokens.shift();
    if (left == undefined && (next[0] == "number" || next[0] == "float")){  // If left is undefined, then the +/- symbol must denote positive / negative number
      if (token[1] == "-"){
        next[1] = "-" + next[1];  // Prefix number with - symbol as it is negative.  Numbers are assumed to be positive so + symbols can be ignored
      }
      if (identifiedTokens[0][0] == "operator"){  // If the number is followed by an operator it must be part of an expression
        return parse_expression(next);
      }
      return parse_literal(next);  // If not followed by an operator the number must be on its own
    }
    else{
      errors.syntax.unexpected([["number", null], ["float", null]], next, next[2]);  // + or - outside expression not followed by a number must be a mistake
    }
  }
  else{
    return parse_expression(token, left);
  }
}

function parse_class(token){
  parserStack.push("parse_class");
  // Implement classes at a higher level
}

function parse_for(token){
  parserStack.push("parse_for");
  var next = identifiedTokens.shift();  // Get next token
  if (next[1] != "("){  // For must be followed by open bracket
    errors.syntax.unexpected([["separator", "("]], next, next[2]);
  }
  next = identifiedTokens.shift();
  var condition = parse_expression(next);
  if (next[1] != ")"){  // Expression must be followed by close bracket
    errors.syntax.unexpected([["separator", ")"]], next, next[2]);
  }
  next = identifiedTokens.shift();
  if (next != "{"){
    errors.syntax.unexpected([["separator", "{"]], next, next[2]);
  }
  var innerCode = [];  // Syntax tree for code within the loop
  while (next[1] != "}"){
    next = identifiedTokens.shift();
    innerCode.push(parsers[next[0]](next));
  }
  return {"type": "for", "condition": condition, "code": innerCode};
}

function parse_while(token){
  parserStack.push("parse_while");
  var next = identifiedTokens.shift();  // Get next token
  handleUndefined(next);
  if (next[1] != "("){  // While must be followed by open bracket
    errors.syntax.unexpected([["separator", "("]], next, next[2]);
  }
  next = identifiedTokens.shift();
  handleUndefined(next);
  var condition = parse_expression(next);

  next = identifiedTokens.shift();
  handleUndefined(next);
  if (next[1] != "{"){
    errors.syntax.unexpected([["separator", "{"]], next, next[2]);
  }
  var innerCode = getTokenSublist("{", "}");  // Syntax tree for code within the loop
  innerCode = sub_parser(innerCode);
  return {"type": "while", "condition": condition, "code": innerCode};
}

function parse_function(token){
  parserStack.push("parse_function");
  var next = identifiedTokens.shift();  // Get next token
  handleUndefined(next);
  if (next[0] != "identifier"){
    errors.syntax.unexpected([["identifier", null]], next, next[2]);
  }
  var name = parse_definition_identifier(next);
  next = identifiedTokens[0];
  handleUndefined(next);
  if (next[1] != "("){
    errors.syntax.unexpected([["separator", "("]], next, next[2]);
  }
  next = identifiedTokens.shift();
  handleUndefined(next);
  var args = parse_args();
  // Check that the arguments provided are identifiers or assignments to identifiers
  for (let i = 0; i < args.length; i++){
    let arg = args[i];
    if (!(arg["type"] == "identifier" || (arg["type"] == "=" && arg["left"]["type"] == "identifier"))){
      throw errors.syntax.invaliddefinitionparams(next[2]);
    }
  }
  next = identifiedTokens.shift();
  handleUndefined(next);
  if (next[1] != "{"){
    errors.syntax.unexpected([["separator", "{"]], next, next[2]);
  }
  // Parse code inside function
  var innerCode = [];  // Syntax tree for code within the function
  innerCode = getTokenSublist("{", "}");
  innerCode = sub_parser(innerCode);
  return {"type": "function", "name": name, "args": args, "code": innerCode};
}

function parse_global(token){  // Parse global keyword
  parserStack.push("parse_global");
  var next = identifiedTokens.shift();
  if (next[0] != "identifier"){
    errors.syntax.unexpected([["identifier", null]], next, next[2]);
  }
  return {"type": "global", "identifier": parse_identifier(next)};
}

function parse_if(token){
  parserStack.push("parse_if");
  var next = identifiedTokens.shift();  // Get next token
  if (next == undefined || next[1] != "("){  // If must be followed by open bracket
    errors.syntax.unexpected([["separator", "("]], next, next[2]);
  }
  next = identifiedTokens.shift();
  var condition = parse_expression(next);
  //next = identifiedTokens.shift();
  //if (next[1] != ")"){  // Expression must be followed by close bracket
  //  errors.syntax.unexpected([["separator", ")"]], next, next[2]);
  //}
  next = identifiedTokens.shift();
  if (next == undefined || next[1] != "{"){
    errors.syntax.unexpected([["separator", "{"]], next, next[2]);
  }
  var innerCode = [];  // Syntax tree for code within the loop
  /* while (next[1] != "}"){
    next = identifiedTokens.shift();
    if (next == undefined) {errors.syntax.incomplete;}
    innerCode.push(parsers[next[0]](next));
  } */
  let innerTokens = getTokenSublist("{", "}");
  innerCode = sub_parser(innerTokens);
  next = identifiedTokens[0];
  var elses = [];  // Else statements
  while (next != undefined && next[1] == "else"){
    identifiedTokens.shift();  // Remove else from tokens so it is not processed twice
    elses.push(parse_else(next));
    next = identifiedTokens[0];
  }
  return {"type": "if", "condition": condition, "code": innerCode, "else": elses};
}

function parse_else(token){
  parserStack.push("parse_else");
  var next = identifiedTokens.shift();
  if (next != undefined && next[1] == "if"){
    next = identifiedTokens.shift();
    handleUndefined(next);
    if (next[1] != "("){  // If must be followed by open bracket
      errors.syntax.unexpected([["separator", "("]], next, next[2]);
    }
    next = identifiedTokens.shift();  // Get first token of condition
    handleUndefined(next);
    var condition = parse_expression(next);  // Parse condition
    next = identifiedTokens.shift();  // Get first token after condition (should be "{")
    handleUndefined(next);
    if (next[1] != "{"){
      errors.syntax.unexpected([["separator", "{"]], next, next[2]);
    }
    var innerCode = [];  // Syntax tree for code within the loop
    let innerTokens = getTokenSublist("{", "}");
    innerCode = sub_parser(innerTokens);
    return {"type": "else if", "condition": condition, "code": innerCode};
  }
  else{
    if (next[1] != "{"){
      errors.syntax.unexpected([["separator", "{"]], next, next[2]);
    }
    var innerCode = [];  // Syntax tree for code within the loop
    let innerTokens = getTokenSublist("{", "}");
    innerCode = sub_parser(innerTokens);
    return {"type": "else", "code": innerCode};
  }

}

function parse_import(){
  parserStack.push("parse_import");
  let token = identifiedTokens.shift();
  handleUndefined(token);
  return {"type": "import", "path": parsers[token[0]](token)};
}

function parse_return(){
  parserStack.push("parse_return");
  let token = identifiedTokens.shift();
  handleUndefined(token);
  return {"type": "return", "value": parsers[token[0]](token)};
}

function parse_reference(){
  parserStack.push("parse_reference");
  let token = identifiedTokens.shift();
  handleUndefined(token);
  if (token[0] != "identifier"){
    throw errors.syntax.unexpected([["identifier", null]], token, token[2]);
  }
  return {"type": "reference", "identifier": parse_identifier(token)};
}

function parse_literal(token){
  parserStack.push("parse_literal");
  return {"type": token[0], "value": token[1]};
}

function parse_separator(token){
  parserStack.push("parse_separator");
  var tree;
  if (token[1] == "["){  // Beginning of a list
    tree = parse_list(token);
  }
  else if (token[1] == "{"){  // Beginning of a dictionary
    tree = parse_dict(token);
  }
  while (identifiedTokens[0] != undefined && identifiedTokens[0][1] == "["){  // An index of the newly declared list or dict
    identifiedTokens.shift();
    tree = {"type": "index", "name": tree, "index": parse_index()};
    while (identifiedTokens[0] != undefined && identifiedTokens[0][1] == "("){
      identifiedTokens.shift();
      tree = {"type": "call", "name": tree, "args": parse_args()};
    }
  }
  return tree;
}

function parse_list(){  // Parse list
  parserStack.push("parse_list");
  return {"type": "list", "items": parse_list_args()};
}


function parse_list_args(){
  parserStack.push("parse_list_args");
  var args = {};
  var argscount = 0;  // Number of arguments supplied
  var end = false;
  var argument = {};

  while (end == false){
    let token = identifiedTokens.shift()  // Get next token
    if (token == undefined){
      errors.syntax.incomplete();
    }
    if (token[1] == "]"){  // End of args
      args[argscount] = argument;  // Add final argument to args
      end = true;
      break;
    }
    else if (token[1] == ","){  // End of one argument, but another has been supplied
      args[argscount] = argument;  // Add argument to args
      argscount++;  // Increment argscount
      argument = {};  // Clear argument ready for next argument
    }
    argument = parsers[token[0]](token);  // Parse list argument using correct parsing function
    if (identifiedTokens[0] == undefined){
      errors.syntax.incomplete();
    }
    if (token[1] != "," && !(identifiedTokens[0][1] == "," || identifiedTokens[0][1] == "]")){  // An argument must be followed by , or ] for syntax to be valid
      errors.syntax.unexpected([["separator", ","], ["seperator", "]"]], identifiedTokens[0], identifiedTokens[0][2]);  // Raise syntax error
    }
  }
  return args;
}

function parse_dict(token){
  parserStack.push("parse_dict");
  var items = [];
  var end = false;
  while (end === false){
    if (identifiedTokens[0] == undefined){
      errors.syntax.invalidexpression.unmatchedparantheses(token[2]);
    }
    let token = identifiedTokens.shift();  // Get next token
    if (token[1] == "}"){
      end = true;
    }
    else{
      items.push(parse_dict_pair(token));
    }
  }
  return {"type": "dict", "items": items};
}

function parse_dict_pair(token){
  parserStack.push("parse_dict_pair");
  if (!(token[0] == "string" || token[0] == "number" || token[0] == "float" || token[0] == "identifier")){  // Dictionary keys must be a string, number, float, or identifier
    errors.syntax.invalidkeytype(token[1], token[2]);  // Key is not one of the allowed types
  }
  var pair = [];
  var next = identifiedTokens[0];
  if (next == undefined){
    errors.syntax.invalidexpression.unmatchedparantheses(token[2]);
  }
  if (next[1] == "}"){  // End of dict declaration has been reached
    return pair;
  }
  else{
    var key = parsers[token[0]](token);  // Parse key
  }
  next = identifiedTokens.shift();
  if (next[1] != ":"){  // A key must be followed by colon separator
    errors.syntax.unexpected([["separator", ":"]], next[1], next[2]);
  }
  else{
    next = identifiedTokens.shift();
    if (next == undefined){
      errors.syntax.invalidexpression.unmatchedparantheses(token[2]);
    }
    var value = parsers[next[0]](next);  // Parse value
    next = identifiedTokens[0]
    if (next == undefined){
      errors.syntax.incomplete();
    }
    if (next[1] == "," || next[1] == "}"){  // End of pair or dict declaration has been reached
      if (next[1] == ","){
        identifiedTokens.shift();  //  Remove from token list if comma, but if } then it must remain to mark the end of the dict declaration
      }
      return [key, value];
    }
    else{
      errors.syntax.unexpected([["separator", ","], ["separator", "}"]], next[1], next[2]);
    }
  }
}

function parse_index(){  // Parse the index part of a list or dict identifier e.g. [0]
  try{
  var token = identifiedTokens.shift();
  var tree = parsers[token[0]](token);
  if (identifiedTokens[0][0] == "operator"){  // If next token is an operator, then the index must contain an expression
    tree = parse_expression(tree);
  }
  token = identifiedTokens.shift();
  if (token[1] != "]"){
    errors.syntax.unexpected([["separator", "]"]], token[1], token[2]);
  }
  return tree;
}
catch (err){
  errors.syntax.incomplete();
}
}


function multi_token_operator(token){  // Checks whether an operator is a multi character operator (such as ==)
  // Returns an array containing true and the correct token if operator is multi character, or simply [false] if it is not
  var next = identifiedTokens[0];
  var outputArray = [false];
  if (token[1] == "="){
    if (next[1] == "="){
      outputArray = [true, ["operator", "=="]];
    }
  }
  else if (token[1] == "!"){
    if (next[1] == "="){
      outputArray = [true, ["operator", "!="]];
    }
  }
  else if (token[1] == ">"){
    if (next[1] == "="){
      outputArray = [true, ["operator", ">="]];
    }
  }
  else if (token[1] == "<"){
    if (next[1] == "="){
    outputArray = [true, ["operator", "<="]];
  }
  }
  if (outputArray[0] === true){
    identifiedTokens.shift();  // Remove the second token to avoid it being processed twice
  }
  return outputArray;
}

function valid_consecutive_tokens(token){  // Raises error if an operator is followed by another operator other than those that only need a right value
  if (token[0] == "operator"){
    try {
    var next = identifiedTokens[0];
    if (next[0] == "operator"){
      if (next[1] == "+" || next[1] == "-" || next[1] == "!"){  // There are two operators in a row, but the expression is still valid as +, -, or ! do not need left values
        if (identifiedTokens[1][0] == "operator" || (next[1] == "+" || next[1] == "-") && (identifiedTokens[1][0] != "number" || identifiedTokens != "float")){  // Three operators in a row cannot be valid. If following an operator, +/- is used to denote positive / negative numbers so cannot be followed by anything other than a number or float
          throw errors.syntax.invalidexpression.norightoperand(next[2]);
        }
      }
      else{  // An operator followed by another operator other than +, -, or ! is invalid
        throw errors.syntax.invalidexpression.noleftoperand(next[2]);
      }
    }
  }
  catch (err){  // If there is no next token, a type error will be thrown when trying to compare the non-existent token.  If the current token is an operator, then it cannot have no token on the right, so an error should be thrown
    errors.syntax.invalidexpression.norightoperand(token[2]);
  }
}
}

function containsTokens(arr){  // Returns true if the array contains any tokens in un-parsed form i.e. [type, value]
  for (var i in arr){
    if (getObjectType(arr[i]) == "array"){
      return true;  // A token has been found, so there is no need to continue
    }
  }
  return false;  // No tokens have been found
}

function isConstant(token){  // Return true if the token is one of the constant types, and false otherwise
  if (token[0] == "string" || token[0] == "number" || token[0] == "float" || token[0] == "bool"){
    return true;
  }
  else{
    return false;
  }
}

function getObjectType(obj){  // Determine whether an object is an array or object
  if (obj.constructor == Array){
    return "array";
  }
  else{
    return "object";
  }
}

function handleUndefined(token){  // Check if a token is undefined, and raise the "incomplete code" error if necessary  Function should only be in cases where a) an undefined token is syntactically incorrect (i.e. in the middle of a statement) and b) a case specific error is not unnecessary
  if (token == undefined){
    errors.syntax.incomplete();
  }
}

function getTokenSublist(open_symbol, close_symbol){  // Get all tokens between an open and close bracket e.g. between { and }
  var token_list = [];
  var open_brackets = 0;
  var next = identifiedTokens.shift();
  handleUndefined(next);
  while (next[1] != close_symbol || open_brackets > 0){
    handleUndefined(next);
    if (next[1] == open_symbol){
      open_brackets++;
    }
    else if (next[1] == close_symbol){
      open_brackets--;
    }
    token_list.push(next);
    next = identifiedTokens.shift();
    handleUndefined(next);
  }
  return token_list;
}

function sub_parser(token_list){  // Run the parser with a different version of identifiedTokens, in order to parse sub-expressions e.g. a + b[12 + 1] - the 12 + 1 for the list index is a separate expression from the a + b[] expression so must be parsed separately
  // Store a "copy" of the original identifiedTokens
  let currentTokens = identifiedTokens;
  // Replace identifiedTokens with the provided list of tokens
  identifiedTokens = token_list;
  // Store a "copy" of the current syntax tree
  let currentTree = syntaxTree;
  // Create an empty version of syntaxTree to hold the new tree
  syntaxTree = [];
  // Parse the new version of identifiedTokens
  parse_program();
  // Keep a copy of the new syntaxTree
  let newTree = syntaxTree;
  // Put the old syntaxTree and version of identifiedTokens back in place
  identifiedTokens = currentTokens;
  syntaxTree = currentTree;

  return newTree;
}
