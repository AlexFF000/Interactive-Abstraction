var errors = {"lexical": {"message": "Lexical Error: ", "InvalidCharacter": function (char, pos){
  var message = errors.lexical.message + ("Invalid Character: " + char);  // Add character to error message
  message = addPosition(message, pos);
  outputConsole(message);
  throw message;  // Raise exception to stop execution
},
"InvalidToken": function (char, pos){
  var message = errors.lexical.message + ("Invalid Token: " + char);  // Add token to error message
  message = addPosition(message, pos);
  outputConsole(message);
  throw message;  // Raise exception to stop execution
}},
"syntax": {"message": "Syntax Error: ",
"unexpected": function(expected, got, pos){
  var message = errors.syntax.message + ("Expected " + expectedMessage(expected) + " but got '"+ typeOrValue(got) + "'");
  message = addPosition(message, pos);
  outputConsole(message);
  throw message;  // Raise exception to stop execution
},
"invalidkeytype": function(got, pos){
  var message = errors.syntax.message + ("Invalid Key: '" + got + "' Dictionary keys must be a number, float, string, or valid identifier");
  message = addPosition(message, pos);
  outputConsole(message);
  throw message;
},
"incomplete": function(){
  var message = errors.syntax.message + "Incomplete Code: Token stream ends too early to create valid statement";
  outputConsole(message);
  throw message;
},
"invaliddefinitionparams": function(pos){
  var message = errors.syntax.message + "Parameter provided to function definition is not an identifier";
  message = addPosition(message, pos);
  outputConsole(message);
  throw message;
},
"invalidexpression": {"unmatchedparantheses": function(pos){
  var message = errors.syntax.message + "Unmatched Parentheses";
  message = addPosition(message, pos);
  outputConsole(message);
  throw message;},
"unusabletokens": function(pos){
  var message = errors.syntax.message + "Tokens do not create a valid expression";
  message = addPosition(message, pos);
  outputConsole(message);
  throw message;
},
"noleftoperand": function(pos){
  var message = errors.syntax.message + "Operator not preceded by a value";
  message = addPosition(message, pos);
  outputConsole(message);
  throw message;
},
"norightoperand": function(pos){
  var message = errors.syntax.message + "Operator not followed by a suitable value";
  message = addPosition(message, pos);
  outputConsole(message);
  throw message;
},
}
}
}

function errors(char, pos){
  this.message = "";
  this.lexical = function(char, pos){
    this.message += "Lexical Error:";  // This needs to point to parent this
    this.InvalidCharacter = function(char, pos){  // But this needs to point to local this for lexical function

    }
  }
}

function addPosition(message, pos){  // Add position information to error message
  // pos format: [line, column]
  position = " Line " + pos[0] + ", Column " + pos[1];
  return message + position;
}

function outputConsole(text){
  // Output text to user;
}

function expectedMessage(expected){  // Prepare "expected:" section of error message
  var message = "";
  if (expected.length > 1){
    message = "one of the following (";
    for (var i = 0; i < expected.length; i++){
      message += "'" + typeOrValue(expected[i]) + "'";
      if (i == expected[0].length -1){  // i is last token
        message += ")";
      }
      else{
        message += " or ";
      }
    }
  }
  else{
    message += "'" + typeOrValue(expected[0]) + "'";
  }
  return message;
}

function typeOrValue(token){  // Decide whether to use token type or token value in message
  if (token[1] === null){  // Use token type
    return "type: " + token[0];
  }
  else{
    return token[1];
  }
}
