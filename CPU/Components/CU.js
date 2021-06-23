
var commands;
var opcode;
var mode;
var operand;
var ticks;
var freq;
var queue = []; // Points to functions for each command
var subqueue = []; // Merges into queue to add next instruction
var pauseQueue;  // Contains queue when paused in unlimited speed mode
var ioWaiting = 0;  // Indicates that a waiting I/O request has already been aknowledged by CPU but is waiting for CPU time to be processed


function control(instructions, frequency){ // Recieve instructions, load into memory, start simulation
  freq = 1000 / frequency;
  initMem();
  initBus();
  initReg();
  commands = [ // Array of functions for each opcode
     add,
     sub,
     bitwiseAnd,
     bitwiseOr,
     bitwiseXor,
     bitwiseNot,
     read,
     write,
     goto,
     branch_ifZero,
     branch_ifNeg,
     branch_ifOverflow,
     branch_ifCarry,
     output,
     input,
     end
  ];
  // Load instructions into memory
  reporting("Loading instructions into memory");
  var x = 0;  // Instructions are 14 bits long but RAM supports only 8 bits
  for (var i = 0; i < instructions.length; i++){
    if (expanded_memory == true){  // 32 bit mode instructions are formatted differently, so a different loading procedure is necessary
      var currentInst = instructions[i]
      var lp = 0;  // Left pointer
      var rp = 8;  // Right pointer
      while (rp <= currentInst.length){
        RAM[x] = currentInst.slice(lp, rp);
        memUpdate(x);
        x++;  // Increment pointers
        lp += 8;
        rp += 8;
      }
    }
    else{
      RAM[x] = instructions[i].slice(0, 8); // Instructions are split into two parts
      memUpdate(x)
      x++;
      let tmp = [0, 0];
      tmp = tmp.concat(instructions[i].slice(8, 15)) // With two zeroes added to the second (6 bit) part to make 8 bits
      RAM[x] = tmp;  // Then placed into two consecutive memory addresses
      memUpdate(x); // Update memory UI
      x++;
  }
  }
  queue.push("fetch()"); // Add fetch to operations queue
  clock(); // Start clock
}

function add(){ // Operations for addition instruction
    subqueue = [
      "dataRequest()",
      "busGrant()",
      "getVal(1)",
      "dataRequest()",
      "busGrant()",
      "updateBus(DATABUS, ACC)",
      "getVal(2)",
      "addition()",
      "dataRequest()",
      "busGrant()",
      "updateBus(DATABUS, outList)",
      "update(ACC)"
    ]

  }


function sub(){
  subqueue = [ // Operations for subtraction instruction
    "getVal(1)",
    "twosComplement()",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, outList)",
    "getVal(1)",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, ACC)",
    "getVal(2)",
    "subtract = true",
    "addition()",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, outList)",
    "update(ACC)"
  ]
}

function bitwiseAnd(){
  subqueue = [ // Operations for and instruction
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, MDR)",
    "getVal(1)",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, ACC)",
    "getVal(2)",
    "and()",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, outList)",
    "update(ACC)"

  ]
}

function bitwiseOr(){
  subqueue = [ // Operations for or instruction
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, MDR)",
    "getVal(1)",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, ACC)",
    "getVal(2)",
    "or()",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, outList)",
    "update(ACC)"
  ]
}

function bitwiseNot(){
  subqueue = [ // Operations for not instruction
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, ACC)",
    "getVal(1)",
    "not()",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, outList)",
    "update(ACC)",
  ]
}

function bitwiseXor(){
  subqueue = [ // Operations for xor instruction
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, MDR)",
    "getVal(1)",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, ACC)",
    "getVal(2)",
    "xor()",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, outList)",
    "update(ACC)"
  ]

}

function read(){

    // Request bus permissions, put on address bus, get operand from memory, perms, data on data bus, put into accumulator
    subqueue =[ // Operations for read instruction
      "CONTROLBUS.read = 1",
      "updateBus(ADDRESSBUS, MDR)",
      "getAddress()",
      "dataRequest()",
      "busGrant()",
      "outputData()",
      "update(ACC)",
      "CONTROLBUS.read = 0"
    ]
}

function write(){
    // Request bus permissions, put on address bus, get data from accumulator, perms, data on data bus, write to memory
    subqueue = [ // Operations for write instruction
      "CONTROLBUS.write = 1",
      "updateBus(ADDRESSBUS, MDR)",
      "getAddress()",
      "dataRequest()",
      "busGrant()",
      "updateBus(DATABUS, ACC)",
      "writeData()",
      "CONTROLBUS.write = 0"
    ]
}

function goto(){
  if (expanded_memory == true){
    subqueue = [ // Operations for goto instruction
      "dataRequest()",
      "busGrant()",
      "updateBus(DATABUS, MDR.slice(0,8))",
      "update(PC)",
      "rotate(PC, 8, 'l')",
      "dataRequest()",
      "busGrant()",
      "updateBus(DATABUS, MDR.slice(8, 16))",
      "update(PC)",
      "rotate(PC, 8, 'l')",
      "dataRequest()",
      "busGrant()",
      "updateBus(DATABUS, MDR.slice(16, 24))",
      "update(PC)",
      "rotate(PC, 8, 'l')",
      "dataRequest()",
      "busGrant()",
      "updateBus(DATABUS, MDR.slice(24, 32))",
      "update(PC)"
    ]
  }
  else{
    subqueue = [ // Operations for goto instruction
      "dataRequest()",
      "busGrant()",
      "updateBus(DATABUS, MDR)",
      "update(PC)"
  ]
}
}

function branch_ifZero(){ // If zero flag is set, perform a goto instruction
  if (STATUS[0] == 1){
    reporting("Zero flag is set, branching");
    goto();
  }
  else {
    reporting("Zero flag is not set");
    subqueue = []; // If condition is not met, the operations queue is cleared to skip to next instruction
  }
}

function branch_ifNeg(){ // If negative flag is set, perform a goto instruction
  if (STATUS[1] == 1){
    reporting("Negative flag is set, branching")
    goto();
  }
  else{
    reporting("Negative flag is not set");
    subqueue = [];
  }
}

function branch_ifOverflow(){ // If overflow flag is set, perform a goto instruction
  if (STATUS[2] == 1){
    reporting("Overflow flag is set, branching");
    goto();
  }
  else {
    reporting("Overflow flag is not set");
    subqueue = [];
  }
}

function branch_ifCarry(){ // If carry flag is set, perform a goto instruction
  if (STATUS[3] == 1){
    reporting("Carry flag is set, branching");
    goto()
  }
  else{
    reporting("Carry flag is not set");
    subqueue = [];
  }
}






function output(){ // Operations for output instruction
  if (mode == "01" || mode == "1"){ // If addressing mode is 1 (address), data in MDR is outputted
    subqueue = [
    "ioRequest()",
    "ioGrant()",
    "updateBus(IOBUS, MDR)",
    "io_module()",
    "changeIOGrant(0)"
  ]
  }
  else {
    subqueue = [ // Output contents of accumulator onto I/O bus
      "ioRequest()",
      "ioGrant()",
      "updateBus(IOBUS, ACC)",
      "io_module()",
      "changeIOGrant(0)"
    ]
  }
}

function input(){
  subqueue = [  // Load contents of I/O bus into accumulator
    "loadInput()",
    "changeIOGrant(0)"
  ]
}

function end(){
  queue = []; // Clear operations queue
  subqueue = [];
  CONTROLBUS.clock = 0;  // Turn off clock so it is not left on after the program has finished
  endProgram(); // Prepare UI to allow CPU to be restarted
  reporting("Finishing program");
  if (unlimitSpeed != true){
    clearInterval(ticks); // Stop clock ticking to stop operations being performed
  }
}


function busGrant(){ // Grant permission to use the databus
  CONTROLBUS.grant = 1;
  CONTROLBUS.request = 0;
  reporting("Granted use of data bus");
}

function ioGrant(){ // Grant permission to use I/O bus
  changeIOGrant(1)
  CONTROLBUS.iorequest = 0;
  reporting("Granted use of I/O bus");
}

function ioHandler(){  // Interrupt handler for processing I/O requests
  // Must check that use of I/O bus is not currently reserved by another instruction
  if (CONTROLBUS.iogrant == 0){  // Grant is turned off when I/O intruction is complete, so can be used to tell whether I/O bus is in use
    ioGrant()  // Grant use of I/O bus
    ioWaiting = 0;  // Reset to 0 ready for next request
  }
  else{  // Reschedule I/O handler
    queue.push("ioHandler()")  // Will run again after next instruction
  }
}

function fetch(){ // Get instuction from memory and load into the correct registers and update program counter
  if (expanded_memory == true){
    updateBus(ADDRESSBUS, PC);
    getAddress();
    var oprLen = parseInt(address.slice(5, 8).join(""), 2);  // Get number of bytes needed to fetch operand
    subqueue = [
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, PC.slice(0, 8))",
    "update(MAR)",
    "rotate(MAR, 8, 'l')",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, PC.slice(8, 16))",
    "update(MAR)",
    "rotate(MAR, 8, 'l')",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, PC.slice(16, 24))",
    "update(MAR)",
    "rotate(MAR, 8, 'l')",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, PC.slice(24, 32))",
    "update(MAR)",
    //"rotate(MAR, 8, 'l')",
    "CONTROLBUS.read = 1",
    "updateBus(ADDRESSBUS, MAR)",
    "getAddress()",
    "dataRequest()",
    "busGrant()",
    "outputData()",
    "update(MDR)",
    "CONTROLBUS.read = 0",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, MDR.slice(24, 32))",
    "cirUpdate_expanded(1)",
    "increment(PC)"
  ]
  var fetchByte = [
  "increment(MAR)",
  "CONTROLBUS.read = 1",
  "updateBus(ADDRESSBUS, MAR)",
  "getAddress()",
  "outputData()",
  "cirUpdate_expanded(2)",
  "CONTROLBUS.read = 0",
  "increment(PC)"
]
  for (var i = 0; i < oprLen; i++){
    subqueue = subqueue.concat(fetchByte);
  }
  subqueue.push("decode()");  // Add decode instruction
  }
  else{
  subqueue = [ // Get data pt1 from ram > cirupdate > data pt2 from ram > decode()
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, PC)",
    "update(MAR)",
    "CONTROLBUS.read = 1",
    "updateBus(ADDRESSBUS, MAR)",
    "getAddress()",
    "dataRequest()",
    "busGrant()",
    "outputData()",
    "update(MDR)",
    "CONTROLBUS.read = 0",
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, MDR)",
    "cirUpdate(1)",
    "increment(MAR)",
    "CONTROLBUS.read = 1",
    "updateBus(ADDRESSBUS, MAR)",
    "getAddress()",
    "outputData()",
    "cirUpdate(2)",
    "CONTROLBUS.read = 0",
    "increment(PC)",
    "decode()"
  ]
}
  queue = queue.concat(subqueue); // Add subqueue to end of queue to be run by clock

}

function getOperand(){ // Put operand data into MDR ready for instruction execution
  if (expanded_memory == true){
    if (mode == "1"){ // Operand is memory address, actual data must be fetched
      if ([allowedInstructions[6][0], allowedInstructions[7][0], allowedInstructions[8][0], allowedInstructions[9][0], allowedInstructions[10][0], allowedInstructions[11][0], allowedInstructions[12][0]].includes(opcode)){
        // Instruction is one that takes an address (RED, WRT, GTO, BIZ, BIN, BIO, BIC) and mode is 1 so it takes an address of an address
        // As addresses are 4 bytes, load the 4 bytes starting from the one specified in operand into MDR
        subqueue = [
          // Load value of first byte into MDR
          "CONTROLBUS.read = 1",
          "loadOperand(MAR);",
          "updateBus(ADDRESSBUS, MAR)",
          "getAddress()",
          "dataRequest()",
          "busGrant()",
          "outputData()",
          "updatePart(MDR, 0)",
          "CONTROLBUS.read = 0",
          // Increment the MAR for second byte
          "increment(MAR)",
          "updateBus(ADDRESSBUS, MAR)",
          "CONTROLBUS.read = 1",
          "getAddress()",
          "dataRequest()",
          "busGrant()",
          "outputData()",
          "updatePart(MDR, 8)",
          "CONTROLBUS.read = 0",
          // Third byte
          "increment(MAR)",
          "updateBus(ADDRESSBUS, MAR)",
          "CONTROLBUS.read = 1",
          "getAddress()",
          "dataRequest()",
          "busGrant()",
          "outputData()",
          "updatePart(MDR, 16)",
          "CONTROLBUS.read = 0",
          // Fourth byte
          "increment(MAR)",
          "updateBus(ADDRESSBUS, MAR)",
          "CONTROLBUS.read = 1",
          "getAddress()",
          "dataRequest()",
          "busGrant()",
          "outputData()",
          "updatePart(MDR, 24)",
          "CONTROLBUS.read = 0",
        ];
      }
      else{
        var oprLen = parseInt(CIR.slice(5, 8).join(""), 2);  // Get number of bytes used by address
        subqueue = [
          "CONTROLBUS.read = 1",
          "loadOperand(MAR);",
          "updateBus(ADDRESSBUS, MAR)",
          "getAddress()",
          "dataRequest()",
          "busGrant()",
          "outputData()",
          "update(MDR)",
          "CONTROLBUS.read = 0"
        ]
      }
      

  }
  else{
    subqueue = [ // Operand is the data to be operated on
      "dataRequest()",
      "busGrant()",
      "loadOperand(MDR)",
      //"update(MDR)"
    ]
  }
  }
  else{
  if (mode == "01"){ // Operand is memory address, actual data must be fetched
    subqueue = [
      "CONTROLBUS.read = 1",
      "updateBus(MAR, operand)",
      "updateBus(ADDRESSBUS, operand)",
      "getAddress()",
      "dataRequest()",
      "busGrant()",
      "outputData()",
      "update(MDR)",
      "CONTROLBUS.read = 0"
    ]

}
else{
  subqueue = [ // Operand is the data to be operated on
    "dataRequest()",
    "busGrant()",
    "updateBus(DATABUS, operand)",
    "update(MDR)"
  ]
}
}
subqueue.push("execute()"); // Add execute to queue to perform execute function after decode
queue = queue.concat(subqueue);
}

function decode(){ // Separate instruction into opcode, addressing mode and operand
  if (expanded_memory == true){
    subqueue = [
      'opcode = CIR.slice(0, 4).join("")',
      'mode = CIR.slice(4, 5).join("")',
      'operand = CIR.slice(8)',
      'getOperand()', // Place correct operand data in MDR ready for use during execution
    ]
  }
  else{
  subqueue = [
    'opcode = CIR.slice(0, 4).join("")',
    'mode = CIR.slice(4, 6).join("")',
    'operand = CIR.slice(6, 14)',
    'getOperand()', // Place correct operand data in MDR ready for use during execution
  ]
}
  queue = queue.concat(subqueue);
}

function execute(){ // Add correct operations to queue to perform instruction
    opcode = parseInt(opcode, 2);
    commands[opcode](); // Get list of operations for instruction
    queue = queue.concat(subqueue); // Add list to operations queue
    queue.push("fetch()"); // Add fetch to end of queue to run next instruction


}

function pause(){ // Freeze CPU
  paused = true;
  if (unlimitSpeed == true){
    pauseQueue = queue;  // Make "copy" of queue
    queue = [];  // Empty queue to stop the clock

  }
  else{
    clearInterval(ticks); // Stop the clock
  }
}

function resume(){ // Un-freeze CPU
  paused = false;
  if (unlimitSpeed == true){
    queue = pauseQueue;  // Restore queue
  }
  clock(); // Start clock
}

function invert(value){
  if (value == 0){
    return 1;
  }
  else{
    return 0;
  }
}

function clock(){ // Run one operation in queue every clock pulse
  var frequency = freq / 2;
  function runProcesses(){
    CONTROLBUS.clock = invert(CONTROLBUS.clock);  // Alternate between on and off on each run
    if (CONTROLBUS.clock == 1){
      eval(queue[0]);
      queue.shift();
      if (CONTROLBUS.iorequest == 1){  // Check for I/O requests
        if (ioWaiting == 0){  // I/O request has not yet been aknowledged
          queue.push("ioHandler()");  // Schedule ioHandler to process request
          ioWaiting = 1;  // Show that ioHandler has already been scheduled, to avoid processing multiple times
        }
      }
  }
  uiUpdate();
}
  ticks = setInterval(runProcesses, frequency); // Start clock pulses
  }

  function unlimited_clock(){  // Run without delay between clock pulses
    var operationCount = 0;
    while (queue.length > 0){
      eval(queue[0]);  // Perform operation
      queue.shift();
      if (CONTROLBUS.iorequest == 1){  // Check for I/O requests
        if (ioWaiting == 0){  // I/O request has not yet been aknowledged
          queue.push("ioHandler()");  // Schedule ioHandler to process request
          ioWaiting = 1;  // Show that ioHandler has already been scheduled, to avoid processing multiple times
        }
      }
      operationCount++;
      if (operationCount > 10000){  // Take a 15ms break every 10,000 operations to allow background code to run to prevent browser hanging
        pause();
        setTimeout(resume, 15);
        operationCount = 0;  // Reset operation count
      }
    }
  }

var default_clock_function = clock;  // Create global reference to default clock function for use changing back from unlimited speed mode
