Tokens = {"character": function(char){
  if (char.search(/[a-z0-9/{}][,.()"+-*=&|!\r\n ]/i) != -1){  // Check if char is allowed character
    currentToken = Tokens["character"];  // Character is an allowed character in the language
    if (Tokens.operator(char) === false);
    else if (Tokens.symbol(char) === false);
    else if (Tokens.number(char) === false);
    else if (Tokens.letter(char) === false);
  }
  else{
    errors.lexical.InvalidCharacter(char, [line, column]);  // Character is not allowed in the language
    return false;
  }
},
"operator": function(char){
  if (char.search(/[+-*=&|!]/) != -1){
    currentToken = Tokens["operator"];  // Character is an operator
  }
  else {
    return false;
  }
},
"symbol": function(char){
  if (char.search(/[/{}][,.()"'\r\n ]/) != -1){
    currentToken = Tokens["symbol"];  // Character is a symbol in the langauge
    if (Tokens.separator(char) === false);
    else if (Tokens.slash(char) === false);
    else if (Tokens.point(char) === false);
    else if (Tokens.singlequote(char) === false);
    else if (Tokens.doublequote(char) === false);
  }
  else{
    return false;
  }
},
"number": function(char){
  if (char.search(/[0-9]/) != -1){
    currentToken = Tokens["number"];  // Character is a number
    if (Tokens.integer(char) === false);
  }
  else{
    return false;
  }
},
"letter": function(char){
  if (char.search(/[a-z]/i) != -1){
    currentToken = Tokens["letter"];
    if (Tokens.bool(char) === false);
    else if (Tokens.identifier(char) === false);
  }
  else{
    return false;
  }
},
"separator": function(char){
  if (char.search(/[/{}][,()\r\n ]/) != -1){
    currentToken = Tokens["separator"];
    if (Tokens.slash(char) === false);
    else if(Tokens.whitespace(char) === false);
    else if (Tokens.carriagereturn(char) === false);
    else if (Tokens.newline(char) === false);
  }
  else{
    return false;
  }
},
"slash": function(char){
  if (char == "/"){
    currentToken = Tokens["slash"];
  }
  else{
    return false;
  }
},
"point": function(char){
  if (char == "."){
    currentToken = Tokens["point"];
  }
  else{
    return false;
  }
},
"whitespace": function(char){
  if (char == " "){
    currentToken = Tokens["whitespace"];
  }
  else{
    return false;
  }
},
"carriagereturn": function(char){
  if (char.search(/[\r]/) != -1){
    currentToken = Tokens["carriagereturn"];
  }
  else{
    return false;
  }
},
"newline": function(char){
  if (char.search(/[\n]/) != -1){
    currentToken = Tokens["newline"];
  }
  else{
    return false;
  }
},
"singlequote": function(char){
  if (char == "'"){
    currentToken = Tokens["singlequote"];
  }
  else{
    return false;
  }
},
"doublequote": function(char){
  if (char == '"'){
    currentToken = Tokens["doublequote"];
  }
  else{
    return false;
  }
}}
