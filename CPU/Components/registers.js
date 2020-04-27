var PC;
var CIR;
var MAR;
var MDR;
var ACC;
var STATUS;
var cirarray = [];
function initReg(){ // Initialise register arrays
  if (expanded_memory == true){
    PC = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    MAR = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    MDR = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  }
  else{
    PC = [0,0,0,0,0,0,0,0];
    MAR = [0,0,0,0,0,0,0,0];
    MDR = [0,0,0,0,0,0,0,0];
}
  CIR = [0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  ACC = [0,0,0,0,0,0,0,0];
  STATUS = [ 0, // Zero
             0, // Negative
             0, // Overflow
             0 // Carry
          ];
}

function update(register){ // Put contents of DATABUS into given array
  if (expanded_memory == true){
    var regLength = register.length - 1;
    for (var i = 0; i < 8; i++){ // Deep copy values from end to start
      register[regLength - i] = parseInt(DATABUS[7 - i], 2);
    }

  }
  else{
    for (var i = 0; i < 8; i++){ // Deep copy values
      register[i] = parseInt(DATABUS[i], 2);
    }
}
}

function rotate(register, times, direction){  // Shift bits a given number of places in a given direction
  if (direction == "l"){  // Rotate left
    for (var i = 0; i < times; i++){
      var startValue = register.shift();  // Remove first element and remember it
      register.push(startValue);  // Append first element to end of register
    }
  }
  else{  // Rotate right
    for (var i = 0; i < times; i++){
      var endValue = register.pop();  // Remove last element and remember it
      register.unshift(endValue);  // Add last element to start of register
    }
  }
}

function loadInput(){  // Put contents of IOBUS into accumulator
  reporting("Loading data on I/O bus into accumulator")
  for (var i = 0; i < 8; i++){  // Deep copy  values
    ACC[i] = parseInt(IOBUS[i], 2);
  }
}

function cirUpdate(part){ // Update CIR to contain instruction ready to be decoded
 // Due to 14 bit instructions, but only 8 bit word size- instructions are stored in two consecutive memory addresses
 // The cir is updated in two parts, from two addresses
  if (part == 1){
    cirarray = [];
    //updateBus(cirarray, DATABUS); // Put first half of instruction into CIR array
    cirarray = cirarray.concat(DATABUS);
  }
  else if (part == 2){
       // Push last 6 bits from DB to cirarray
    cirarray = cirarray.concat(DATABUS.slice(2, 8)); // First two bits of part 2 are meaningless zeros because instruction is 14 bit. These bits are discarded and the remaining 6 added to end of cir array
    CIR = cirarray; // Contents of cir array placed in CIR
  }
}

function statusUpdate(){ // Update status register from flags register
  var flag = CONTROLBUS.flags[0]; // First flag line indicates which flag is to be updated, second line indicated what it is changed to
  if (CONTROLBUS.flags[1] == 0){
    STATUS[flag] = 0;
  }
  else {
    STATUS[flag] = 1;
  }
  }

function increment(reg){ // Update PC or MAR ready for next instruction
  var end = 8;  // Size of register
  if (reg == PC){
    var val1 = PC;
    var val2 = [0,0,0,0,0,0,1,0]; // Add two to PC (not 1 becuase each instuction takes 2 addresses)
    if (expanded_memory == true){
      end = 32;
      val2 = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1];  // In expanded mode, instructions are different so only increment by 1 at a time
    }
  }
  else if (reg == MAR){
    var val1 = MAR;
    var val2 = [0,0,0,0,0,0,0,1]; // Update MAR by 1 to get part two of instuction
    if (expanded_memory == true){
      end = 32;
      val2 = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1];  // In expanded mode, instructions are different so only increment by 1 at a time
    }
  }
  var outList = [];
  var carry = 0;
  len = end;
  for (var i = 0; i < end; i++){
    var sum = val1[len - 1] + val2[len - 1] + carry;
    if (sum == 0){
      outList.unshift(0);
      carry = 0;
    }
    else if (sum == 1){
      outList.unshift(1);
      carry = 0;
      }
    else if (sum > 1){
      if (sum == 3){
        outList.unshift(1);
        carry = 1;
      }
      else{
      outList.unshift(0)
      carry = 1;
    }
    }
    len--;
    if (carry == 1 && len == 0){
      outList.unshift(1);
    }
    }
    if (reg == PC){ // Update registers to new value
      PC = outList;
  }
    else if (reg == MAR){
      MAR = outList;
  }
}

function cirUpdate_expanded(part){ // Update CIR to contain instruction ready to be decoded (32 bit mode)
 // Due to 14 bit instructions, but only 8 bit word size- instructions are stored in two consecutive memory addresses
 // The cir is updated in two parts, from two addresses
  if (part == 1){
    CIR = [];
    CIR = CIR.concat(DATABUS)
  }
  else if (part == 2){  // Part two and onwards does not need to clear cirarray first
       CIR = CIR.concat(DATABUS)
  }
}

function loadOperand(register){  // Deep copy operand into register
  register.length = 0;  // Empty array
  for (var i = 0; i < operand.length; i++){
    register[i] = parseInt(operand[i], 2);
  }
  while (register.length < 32){  // Ensure that register is 32 bits wide
    register.unshift(0);  // Add zero to start of register
  }
}
