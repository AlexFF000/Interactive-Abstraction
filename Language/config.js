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

// Dictionary containing the parameters for setting up the runtime environment (stack size etc...)
var runtime_options = {
  "StackSize": 65536,
  "EvalStackSize": 100,
  "IntFloatPoolSize": 4096,
  "MemorySize": 2 ** 32,
}
