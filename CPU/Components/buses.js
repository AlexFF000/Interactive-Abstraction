var IOGrantListen = false;  // Makeshift event listener to detect change to IO grant line
var CONTROLBUS;
var ADDRESSBUS = [];
var DATABUS = [];
var IOBUS = [];
function initBus(){ // Initialize bus arrays with default values
    CONTROLBUS = {
      "request": 0,
      "grant": 0,
      "write": 0,
      "read": 0,
      "clock": 0,
      "iorequest": 0,
      "iogrant": 0,
      "flags": [0,0]
    }
    if (expanded_memory == true){  // Address bus should be 32 bits wide
      ADDRESSBUS = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    }
    else{
      ADDRESSBUS = [0,0,0,0,0,0,0,0];
    }

    DATABUS = [0,0,0,0,0,0,0,0];
    IOBUS = [0,0,0,0,0,0,0,0];
}


function dataRequest(){ // Announce intention to use data bus
  CONTROLBUS.request = 1;
  reporting("Requesting use of data bus");
}

function ioRequest(){ // Announce intention to use I/O bus
  CONTROLBUS.iorequest = 1;
  reporting("Requesting use of I/O bus");
}

function updateBus(bus, register){ // Update bus array from given array
  var busLength = bus.length - 1;  // Get length to allow iterating backwards
  var regLength = register.length - 1;  // -1 because indexes start at 0
  for (var i = 0; i < register.length; i++){
    bus[busLength - i] = register[regLength - i];
  }
}

function changeIOGrant(new_value){  // Turn I/O grant line on or off
  if (new_value == 1){ // Turn I/O grant line on
    CONTROLBUS.iogrant = 1;
    reporting("Granting use of I/O bus");
    if (IOGrantListen != false){
      updateBus(IOBUS, IOGrantListen);  // Load value into IO bus
      reporting("Loading input value onto I/O bus")
      IOGrantListen = false;  // Switch off listener
    }
  }
  else{  // Turn I/O grant line off
    CONTROLBUS.iogrant = 0;
  }
}

function changeFlag(flagArray){ // Change flag lines on control bus and update status register
  updateBus(CONTROLBUS.flags, flagArray);
  statusUpdate(); // Update status register with data on flag lines
}

function receiveInput(value){  // Take 8 bit binary number and load onto I/O bus
  ioRequest();  // Request use of I/O bus
  IOGrantListen = value;  // Set Listener to load value when request is granted
}
