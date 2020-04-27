var address;
var RAM;
var loc;
function initMem(){ // Initialise memory array with default values (00000000)
  if (expanded_memory == true){  // 32 bit mode is enabled
    RAM = {};
    // Override regular functions with 32 bit mode equivalents
    getAddress = getAddress_expanded;
    writeData = writeData_expanded;

  }
  else{
    RAM = [];
    for (var i = 0; i < 256; i++){
      RAM.push([0,0,0,0,0,0,0,0]);
    }
  }
}

function getAddress(){ // Get reference to data at address currently on ADDRESSBUS
  loc = ADDRESSBUS.join("");
  loc = parseInt(loc, 2);
  address = RAM[loc];
  if (loc > 255 || loc < 0){ // Prevent use of non existent addresses
    reporting("That memory address does not exist");
    clearInterval(ticks);
  }
}

function outputData(){ // Put data from address onto DATABUS
    updateBus(DATABUS, address);

}

function writeData(){ // Take data from DATABUS and place in address
    for (var i = 0; i < 8; i++){
      RAM[loc][i] = parseInt(DATABUS[i], 10); // deep copy data
    }
    memUpdate(loc); // Update memory UI
}

// Memory functions for 32 bit mode
function getAddress_expanded(){
  loc = ADDRESSBUS.join("");
  loc = parseInt(loc, 2);
  address = RAM[loc];
  if (typeof address === "undefined"){  // If address is not initialised then return 00000000
    address = [0,0,0,0,0,0,0,0];
  }
  if (loc > 4294967295 || loc < 0){ // Prevent use of out of range addresses
    reporting("That memory address does not exist");
    clearInterval(ticks);
  }
}

function writeData_expanded(){
  var byte = [];
  var isZero = true;
  for (var i = 0; i < 8; i++){
    let bit = parseInt(DATABUS[i], 10);
    byte[i] = bit;
    if (bit == 1){  // Ensures that values are not all zero
      isZero = false;
    }
  }
  if (isZero == true){
    delete RAM[loc];  // If address contains zero, then it does not need to be stored so can be deleted to save space
  }
  else{
    RAM[loc] = byte;  // Assign to address
  }
  updateWatch();  // Update memory UI
}
