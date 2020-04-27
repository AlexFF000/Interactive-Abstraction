//Arithmetic Logic Unit Simulator


var outList = []; // Array containing output from operations
var val1 = []; // Array containing first value to be for mathematical/logical operation
var val2 = []; // Array containing second value to be for mathematical/logical operation
var subtract;
function getVal(value){ // Get values from databus for use in operations
  if (value == 1){ // Choose which val array to update
    val = val1; // First value
  }
  else{
    val = val2; // Second value
  }
  for (var i = 0; i < 8; i++){
    val[i] = parseInt(DATABUS[i], 10); // Deep copy databus into correct value array
  }

}


function addition(){ // Addition function (also used for subtraction)
  reporting("Beginning addition");
  var len = val1.length; // Get length of val1 array
  outList = []; // Prepare outList array ready to contain result of addition
  var carry = 0;
  for (var i = 0; i < val1.length; i++){ // Each bit is added to bit in corrosponding position in val2. From right to left
    if (val1[len - 1] == 0 && val2[len - 1] == 0){ // Neither is 1
      if (carry == 1){
        outList.unshift(1); // Add 1 to beginning of outlist because carry is 1
        carry = 0;
      }
      else{
        outList.unshift(0); // Add 0 to beginning of outlist
        carry = 0;
    }
    }
    else if ((val1[len - 1] == 1 && val2[len - 1] == 0) ||
    (val1[len - 1] == 0 && val2[len - 1] == 1)){ // One of the values is 1
      if (carry == 1){
        outList.unshift(0); // Carry is 1 meaning that there are two positive values, so result is 0 with carry
        carry = 1; // Carry is set to 1
      }
      else{
        outList.unshift(1);
        carry = 0;
      }
      }
    else if (val1[len - 1] == 1 && val2[len - 1] == 1){ // Both are 1
      if (carry == 1){
        outList.unshift(1); // Carry is 1 meaning 1 and 1 and 1, so result is 1 with carry
        carry = 1;
      }
      else {
      outList.unshift(0); // Both are one so result is 0 with carry
      carry = 1;
    }
    }

    len--; // Reduce len by 1 to work on next bit on the left next loop
    if (carry == 1 && len == 0){ // All 8 bits in outList are filled but another carry is still 1
      changeFlag([3, 1]); // Set carry flag
    }
    else {
      changeFlag([3, 0]); // Unset carry flag to prevent confusion if it was set by previous instruction
    }
    reporting("Added");
    }
    // Note: Carry may be set during subtraction, this does not mean that the result is wrong
    if (outList[0] != val1[0] && outList[0] !=val2[0]){ // Result has different sign bit from val1 and val2 (if they where the same) In signed arithmetic this means that an overflow has occured
      changeFlag([2, 1]); // Set overflow flag
    }
    else {
      changeFlag([2, 0]);
    }

    isZeroOrNeg(); // Set zero flag if result is 0 or negative flag if negative
    }
    // Note: Overflow flag could still be set in unsigned arithmetic, however the user can ignore this as overflow is only relevant with signed arithmetic


function and(){
  // Bitwise AND
  outList = [];
  for (var i = 0; i < val1.length; i++){
    if (val1[i] == 1 && val2[i] == 1){
      outList.push(1);
    }
    else{
      outList.push(0);
    }
  }
  isZeroOrNeg();

}

function or(){
  // Bitwise OR
  outList = [];
  for (var i = 0; i < val1.length; i++){
    if (val1[i] == 1){
      outList.push(1);
    }
    else if (val2[i] == 1) {
        outList.push(1);
    }
    else {
      outList.push(0);
    }

}
isZeroOrNeg();
}


function xor(){
  // Bitwise XOR
  outList = [];
  for (var i = 0; i < val1.length; i++){
    if ((val1[i] == 1 && val2[i] == 0) || (val1[i] == 0 && val2[i] == 1)){ // Only one value is 1
      outList.push(1);
    }
    else {
      outList.push(0);
    }
  }
  isZeroOrNeg();
}

function not(){
  // Bitwise NOT
  outList = [];
  for (var i = 0; i < val1.length; i++){
    if (val1[i] == 0){
      outList.push(1);
    }
    else{
      outList.push(0);
    }

  }
  isZeroOrNeg();
  }

  function twosComplement(){ // Invert value and add 1 to get twos complement representation, to be used for subtraction
    not(); // invert
    val1 = outList;
    val2 = [0,0,0,0,0,0,0,1];
    addition(); // Add 1
  }

  function isZeroOrNeg(){ // Set relavant flag in status register if outList is zero or negative
    var allZero = true;  // is outlist zero?
    for (var i = 0; i < 8; i++){
      if (outList[i] != 0){ // Outlist contains a 1, therefore cannot be zero
        allZero = false;
        break;
      }
    }
    if (allZero){
      changeFlag([0, 1]); // Set zero flag
    }
    else {
      changeFlag([0, 0]); // Unset flag to avoid confusion if it was set by a previous instruction
    }
    if (outList[0] == 1){  // Check sign bit of outList, if 1 it is negative.  This will also set negative flag for unsigned values over 127, however the user can ignore this
      changeFlag([1, 1]); // set negative flag
    }
    else{
      changeFlag([1, 0]);
    }
  }
