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
  "EvalStackSize": 100,  // Must be 255 or less
  "IntFloatPoolSize": 4095,  // Must be a multiple of 5
  "MemorySize": 2 ** 31,
  "VariableTableSize": 2 ** 10,  // Size of variable tables.  Must be a power of 2.  Should not allow for more than 255 slots.  Must allow for at least 2 unused bytes after the last slot (so must be a value, x, that meets the following criteria: (((x - (VarTable._parentHeadersLength + 4)) MOD VarTable._entryLength) >= 2) and (((x - (VarTable._expansionHeadersLength + 4)) MOD VarTable._entryLength) >= 2) )
  "NamePoolSize": 2 ** 10,  // Size of name pools.  Must be a power of 2
}
