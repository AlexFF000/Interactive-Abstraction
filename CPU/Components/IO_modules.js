// Contains functions for input and output devices that can be used with the processor by attaching to I/O bus
// The selected function will be run after each output instruction is completed

var available_modules = {"Numeric input / output": ["IOregister", binaryIO],
"Seven segment display": ["sevenSegment", segmentDisplay]};  // Dict of available modules, and corrosponding id and function
function binaryIO(){  // Default, allows the input of binary
  var value = "";
  for (x = 0; x < IOBUS.length; x++){
    if (IOBUS[x] == 1){
      value += "1";
    }
    else{
      value += "0";
    }
  }
  value = numDisplay(value);  // Convert to decimal if necessary
  document.getElementById("IObox").value = value;
}

function binaryIOInput(){  // Receive input from binaryIO I/O module
  var value = document.getElementById("IObox").value;
  if (value.length == 8 && value.search("/[^01]/") == -1){  // Check input is 8 bit binary
    receiveInput(value);
}
else if (value.length <= 3 && value.length > 0 && value.search("/[^0-9]/")){  // Or input can be 3 digit decimal
  receiveInput(strToBin(value));  // Convert to binary before input
}
 // If validation fails then value is not 8 bit binary, so input will be ignored
}

function segmentDisplay(){  // Each I/O bus line controls a segment on display
  segments = ["A", "B", "C", "D", "E", "F", "G", "DP"];
  for (x = 0; x < IOBUS.length; x++){
    if (IOBUS[x] == 1){
      lines = document.getElementsByClassName("segLine_" + segments[x]);
      for (y = 0; y < lines.length; y++){
        lines[y].style.stroke = "blue";
      }
      document.getElementById("segment_" + segments[x]).style.fill = "red";
    }
    else{
      lines = document.getElementsByClassName("segLine_" + segments[x]);
      for (y = 0; y < lines.length; y++){
        lines[y].style.stroke = "grey";
      }
      document.getElementById("segment_" + segments[x]).style.fill = "grey";
    }
  }
}
