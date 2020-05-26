var keywords = ["class", "else", "false", "for", "function", "global", "if", "import", "in", "inherits", "null", "private", "public", "return", "static", "throw", "true", "reference", "while"];  // List of reserved keywords
var TokenTests = {"character": function(char){
  if (char.search(/[a-z0-9\/\{\}\]\[\,\.\:\;\(\)\"\+\-\*\=\>\<\&\|\!\r\n\ ]/i) != -1){  // Check if char is allowed character
    return true;  // Character is an allowed character in the language
  }
  else{
    errors.lexical.InvalidCharacter(char, [line, column]);  // Character is not allowed in the language
    return false;
  }
},
"operator": function(char){
  if (char.search(/[\+\-\*\=\>\<\&\|\!]/) != -1){
    return true;  // Character is an operator
  }
  else {
    return false;
  }
},
"symbol": function(char){
  if (char.search(/[\/\{\}\]\[\,\.\(\)\"\:\;\'\r\n ]/) != -1){
    return true;  // Character is a symbol in the langauge
  }
  else{
    return false;
  }
},
"number": function(char){
  if (char.search(/[0-9]/) != -1){
    return true; // Character is a number
  }
  else{
    return false;
  }
},
"letter": function(char){
  if (char.search(/[a-z]/i) != -1){
    return true;
  }
  else{
    return false;
  }
},
"separator": function(char){
  if (char.search(/[\/\{\}\]\[\,\.\(\)\:\;\r\n ]/) != -1){
    return true;
  }
  else{
    return false;
  }
},
"slash": function(char){
  if (char == "/"){
    return true;
  }
  else{
    return false;
  }
},
"point": function(char){
  if (char == "."){
    return true;
  }
  else{
    return false;
  }
},
"whitespace": function(char){
  if (char == " "){
    return true;
  }
  else{
    return false;
  }
},
"carriagereturn": function(char){
  if (char.search(/[\r]/) != -1){
    return true;
  }
  else{
    return false;
  }
},
"newline": function(char){
  if (char.search(/[\n]/) != -1){
    return true;
  }
  else{
    return false;
  }
},
"singlequote": function(char){
  if (char == "'"){
    return true;
  }
  else{
    return false;
  }
},
"doublequote": function(char){
  if (char == '"'){
    return true;
  }
  else{
    return false;
  }
},
"removableSeparator": function(char){
  if (char.search(/[\ \r\n]/) != -1){
    return true;
  }
  else{
    return false;
  }
}}

var Tokens = {"character": function(char){
    if (TokenTests.operator(char) === true){
      currentToken = Tokens["operator"];
      tokenName = "operator";
    }
    else if (TokenTests.symbol(char) === true){
      currentToken = Tokens["symbol"];
      tokenName = "symbol";
    }
    else if (TokenTests.number(char) === true){
      currentToken = Tokens["number"];
      tokenName = "number";
    }
    else if (TokenTests.letter(char) === true){
      currentToken = Tokens["letter"];
      tokenName = "letter";
    }
  }
,
"operator": function(char){
  currentToken = Tokens["operator"];  // Character is an operator
  tokenName = "operator";
  endOfToken = true;
  deleteChar = true;
  chars.push(char);
  previousToken = Tokens["operator"];  // An operator can only consist of a single character
  if (TokenTests.separator(char) === true){
    endOfToken = true;
    tokenName = "operator";
    if (TokenTests.removableSeparator(char) === true){
      deleteChar = true;
    }
  }
},
"symbol": function(char){
    if (TokenTests.separator(char) === true){
      currentToken = Tokens["separator"];
      tokenName = "separator";
    }
    else if (TokenTests.slash(char) === true){
      currentToken = Tokens["slash"];
      tokenName = "slash";
    }
    else if (TokenTests.point(char) === true){
      currentToken = Tokens["point"];
      tokenName = "point";
    }
    else if (TokenTests.singlequote(char) === true){
      currentToken = Tokens["singlequote"];
      tokenName = "singlequote";
    }
    else if (TokenTests.doublequote(char) === true){
      currentToken = Tokens["doublequote"];
      tokenName = "doublequote";
    }
  }
,
"number": function(char){
    if (TokenTests.point(char) === true){
      currentToken = Tokens["float"]
      tokenName = "float";
    }
    else if(TokenTests.number(char) === true){
      currentToken = Tokens["number"];
      tokenName = "number";
    }
    else if (TokenTests.separator(char) === true){
      endOfToken = true;
      tokenName = "number";
      if (TokenTests.removableSeparator(char) === true){
        deleteChar = true;
      }
    }
    else{
      currentToken = Tokens["number"];
      tokenName = "number";
      endOfToken = true;
    }
},
"letter": function(char){
    if (TokenTests.letter(char) === true){
      currentToken = Tokens["identifier"];
      tokenName = "identifier";
    }
    else if (TokenTests.separator(char) === true){
      endOfToken = true;
      tokenName = "identifier";
      if (TokenTests.removableSeparator(char) === true){
        deleteChar = true;
      }
    }
},
"separator": function(char){
    if (TokenTests.slash(char) === true){
      currentToken = Tokens["slash"];
      tokenName = "slash";
    }
    else if(TokenTests.whitespace(char) === true){
      currentToken = Tokens["whitespace"];
      tokenName = "whitespace";
    }
    else if (TokenTests.carriagereturn(char) === true){
      currentToken = Tokens["carriagereturn"];
      tokenName = "carriagereturn";
    }
    else if (TokenTests.newline(char) === true){
      currentToken = Tokens["newline"];
      tokenName = "newline";
    }
    else{
      currentToken = Tokens["separator"];
      tokenName = "separator";
      endOfToken = true;
      deleteChar = true;
      chars.push(char);  // Put character into chars otherwise it will be deleted
    }

},
"slash": function(char){
  if (TokenTests.slash(char) === true && openComment === true){  // Both this and the previous char are slashes
    currentToken = Tokens["comment"];  // A double slash denotes the start of a comment
    tokenName = "comment";
    openComment = false;  // Reset openComment to avoid future single slashes being incorrectly registered as double
  }
  else if (TokenTests.slash(char) === true){
    currentToken = Tokens["slash"];
    tokenName = "slash";
    openComment = true;
  }
  else {  // The slash is the division operator
    openComment = false;
    currentToken = Tokens["slash"];
    tokenName = "operator";
    endOfToken = true;
  }
},
"point": function(char){
  endOfToken = true;  // A point outside of a decimal number must divide two tokens (unless it has been used incorrectly)
  tokenName = "point";
},
"whitespace": function(char){
  endOfToken = true;
  deleteChar = true;  // Tells identifyTokens function to omit this from the output tokens as whitespaces are not needed in further stages of compilation
},
"carriagereturn": function(char){
  endOfToken = true;
  deleteChar = true;  // Carriage returns are not needed for future compilation stages
},
"newline": function(char){
  endOfToken = true;
  deleteChar = true;  // New lines are not needed for future compilation stages
  line++;  // Increment line
  column = 0;  // Reset column
},
"singlequote": function(char){
  if (TokenTests.character(char) === true){
    currentToken = Tokens["string"];  // ' followed by any other char marks the beginning of a string
    stringType = "singlequote";
    tokenName = "string";
  }
  else{
    currentToken = "invalid";
  }
},
"doublequote": function(char){
  if (TokenTests.character(char) === true){
    currentToken = Tokens["string"];
    stringType = "doublequote";
    tokenName = "string";
  }
  else{
    currentToken = "invalid";
  }
},
"float": function(char){
  if (TokenTests.number(char) === true){
    currentToken = Tokens["float"];
    tokenName = "float";
  }
  else if (TokenTests.point(char) === true){
    currentToken = Tokens["float"];
    tokenName = "float";
  }
  else if (TokenTests.separator(char) === true){
    endOfToken = true;
    tokenName = "float";
    if (TokenTests.removableSeparator(char) === true){
      deleteChar = true;
    }
  }
  else{
    currentToken = "invalid";
  }
},
"string": function(char){
  tokenName = "string";
  if (TokenTests[stringType](char) === true){
    if (openString == true){
      endOfToken = true;
      deleteChar = true;
      openString = false;
      chars.push(char);  // Push end " into chars, otherwise it will be deleted
    }
    else{
      openString = true;
    }
  }
  else if (TokenTests.newline(char) === true){
    currentToken = "invalid";
  }
  else if (TokenTests.character(char) === true){
    currentToken = Tokens["string"];
  }
},
"identifier": function (char){
  if (TokenTests.letter(char) === true){
    currentToken = Tokens["identifier"];
    tokenName = "identifier";
  }
  else if (TokenTests.separator(char) === true){
    endOfToken = true;
    tokenName = "identifier";
    if (TokenTests.removableSeparator(char) === true){
      deleteChar = true;
    }
  }
  else if (TokenTests.operator(char) === true){
    endOfToken = true;
    tokenName = "identifier";
  }
  else{
    currentToken = "invalid";
  }
},
"comment": function (char){
  if (TokenTests.newline(char) === true){
    tokenName = "comment";
    endOfToken = true;
    deleteChar = true;
    line++;  // Increment line
    column = 0; // Reset column
  }
  else if (TokenTests.character(char) === true){
    currentToken = Tokens["comment"];
    tokenName = "comment";
  }
}
}

var line = 1;
var column = 0;
var separatorChar = "empty";
var endOfToken = false;
var deleteChar = false;
var stringType;  // If current token is a string this specifies whether it was started with double or single quotes (to avoid it being ended with the opposite type)
var openString = false;
var openComment = false;
var currentToken = null;
var tokenName = null;
var previousToken = "undefined";

identifiedTokens = [];
chars = [];
function identifyTokens(char){
  // Restart when a token is finished
  // Start by checking char
  // Then continuosly run currentToken until it returns endOfToken, checking for "invalid" each time
  // If deleteChar is set then output the token ignore the current char and restart on the next character in the stream
  // Otherwise restart on the existing currentChar, as that char is a token in itself.
  var stop = false;
  previousToken = "undefined";
  if (chars.length == 0 && TokenTests.character(char) === true){  // Identify first character in a new token
    currentToken = Tokens["character"];
  }
  while (stop === false){
    if (currentToken == previousToken){  // If the token has not changed then the final type of the token has been identified
      stop = true;
    }
    else if (currentToken == "invalid"){
      errors.lexical.InvalidToken(chars.join(""), [line, column]);
    }
    else{
      previousToken = currentToken;  // Keep record of current state before it changes
      currentToken(char);  // Check whether input can be any other type of token
    }
  }
  if (endOfToken === true){  // Character is a separator marking the end of a lexeme
    createToken();
    endOfToken = false;  // Reset to false
    if (deleteChar === false){
      separatorChar = char;  // Put char in variable to be tokenised on next run of this function
    }
    else if(deleteChar === true){
      deleteChar = false;  // Reset delete char
    }
  }
  else{
    chars.push(char);
  }

}

function createToken(){
  var token = [tokenName, chars.join(""), [line, column]];  // Create token
  if (token[0] == "identifier"){
    token = isKeyword(token[1]);  // Check if identifier name is a keyword
  }
  if (!(token[0] == "comment" || token[0] == "whitespace" || token[0] == "newline")){
    identifiedTokens.push(token);  // Push token to list of tokens (unless it is a comment, in which case ignore it)
  }
  chars = []  // Empty chars
}
function isKeyword(name){
  for (var i = 0; i < keywords.length; i++){
    if (name == keywords[i]){
      if (name == "true" || name == "false"){
        return ["bool", keywords[i], [line, column]];  // If true or false, then create a bool token
      }
      else if (name == "null"){
        return ["null", keywords[i], [line, column]];  // If null, the create token for null
      }
      return ["keyword", keywords[i], [line, column]];  // Change token from identifier to keyword
    }
  }
  return ["identifier", name];  // Name is nt a keyword, so return token unchanged
}
function lexicalAnalyser(code){
  code = code.split("");  // Split string into array of characters
  code.push(" ");  // Add a space to the end of code to mark the end of the last word
  var char;
  while (code.length > 0){
    if (separatorChar != "empty"){
      char = separatorChar;  // A separator character is waiting to be processed
      separatorChar = "empty";
    }
    else{
      char = code.shift();  // Remove first character from code array
    }
    column++;  // Increment column to allow the correct position to be shown in error messages
    identifyTokens(char);
}
}
