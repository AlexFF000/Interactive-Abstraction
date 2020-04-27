var operator_precedence = {  // Dictionary containing precedence scores for different operators
  // By default, this is based on BIDMAS
  "=": 1,
  "|": 2,
  "&": 3,
  "==": 4,
  "!=": 4,
  "<": 5,
  "<=": 5,
  ">": 5,
  ">=": 5,
  "/": 6,
  "*": 6,
  "+": 7,
  "-": 7,
  "!": 8
};

var operator_associativity = {
  "!": "right"

}
