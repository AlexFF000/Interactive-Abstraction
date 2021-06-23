var memUi, paused, inputType, showDecimal, decimalTC;
var input_box, program_counter, memaddr_reg, memdat_reg, acc_reg, currinst_reg, pause_but, start_but;
var addr_bus, dat_bus, mem_table, stat_table, output_field, info_field, inst_conv, conv_opc, conv_mode, conv_opr, conv_out, show_dec, show_neg;
var io_module;  // Module to attach to I/O bus
var allowedInstructions;
var expanded_memory = false;  // 32 bit mode
var unlimitSpeed = false;
var watchlist = {};  // List of memory addresses being watched (32 bit mode)

var labels = {};  // Maps labels to memory addresses

var currentInstructionAddress = 0;  // Start address in memory of the next instruction to be parsed (assembler only)

function getOutputs(){
  // Contains DOM IDs of elements on HTML page
  input_box = "instructionBox"; // Input for entering instructions
  program_counter = "PCbox"; // Output field for program counter
  memaddr_reg = "MARbox"; // Output field for memory address register
  memdat_reg = "MDRbox";  // Output field for memory data register
  acc_reg = "ACCbox"; // Output field for accumulator
  currinst_reg = "CIRbox"; // Output field for current instruction register
  cont_bus = "controlBox"; // Output field for control bus
  mem_table = "memTable"; // Table containing memory addresses
  expanded_memory_ui = "expanded_mode_memory";  // Div for interfacing memory in 32 bit mode
  queryAddress = "queryAddress";  // Field contaning memory address to be queried (32 bit mode)
  queryOutput = "queryResult";  // Field for displaying value of queried address (32 bit mode)
  watchNewAddress = "watchNewAddress"  // Field containing new address to be watched (32 bit mode)
  watchTable = "watchAddresses";  // Table of watched addresses
  stat_table = "statReg"; // Table for status register
  output_field = "outBox"; // Field for outputting data to user
  info_field = "reportBox"; // Field for outputting information and errors to user
  pause_but = "playPause"; // Pause / resume button
  start_but = "load"; // Start button
  speed_field = "clockSpeed"; // Clock speed field
  inst_conv = "converter"; // div for creating machine code instructions
  conv_opc = "pickOpc"; // Opcode box for creating Instructions
  conv_mode = "pickMode"; // Addressing mode box for creating Instructions
  conv_opr = "pickOper"; // Operand box for creating Instructions
  conv_out = "convertBox"; // Output box for creating Instructions
  show_dec = "showInt"; // Checkbox asking user whether to display numbers in decimal
  show_neg = "showTwoC"; // Chekbox asking whether to use twos complement to represent decimal numbers as negative
  toggle_expanded = "toggle_expanded_memory";
  choose_IO = "selectIOModule"  // Selection of IO modules
  help_table = "helpTable";  // Table containing buttons to open help pop-ups
}

function start(){
  function assToBin(word, line){ // Convert assembly instructions to machine code
    var opc = word.slice(0, 3);
    //var mode = word.slice(3, 4);
    var opr = word.slice(4, 8);
    // Convert opcode
    var permitted = false;
    for (var i = 0; i < 16; i++){
      if (allowedInstructions[i][1] == opc){
        opc = allowedInstructions[i][0];
        permitted = true;
        break;
      }
    }
    if (permitted == false){
      badInput(opc, line);
    }

    // Convert addressing mode
    // Get addressing mode
    var mode = word.slice(3, 4);
    if (mode == "d" || mode == "a"){
      // Do nothing, mode is fine
    }
    else{
      mode = "d";
      // No value, or invalid value given, assume mode is D
    }
    // Convert addressing mode to binary
    if (mode == "a"){
      mode = "01";
    }
    else if (mode == "d"){
      mode = "00";
    }
    else {
      badInput(mode, line)
    }
    // Get operand
    word = word.replace(/[^0-9]/g, ""); // Remove any non numerical chars to leave only operand
    var wdlen = word.length;
    if (!(0 < wdlen && wdlen <= 3)){
      if (opc == allowedInstructions[5][0] || opc == allowedInstructions[13][0]
      || opc == allowedInstructions[14][0] || opc == allowedInstructions[15][0]){ // Opcode is not, out, inp or end (does not require operand)
        word = "000";
      }
      else{
        badInput(word, line) // Operand is either too small or too big (or not given)
    }
    }
    opr = word;

    // Convert operand to 8 bit binary
    if (Number(opr) < 256){
      opr = strToBin(opr);
    }
    else {
      badInput(opr, line);
    }

    // Combine into one machine instruction
    word = opc.concat(mode, opr);
    var command = [];
    for (var i = 0; i < 14; i++){
      command.push(word[i]);
    }
    currentInstructionAddress += 2;  // Each instruction uses 2 bytes in memory
    return command;
  }

  memUi = document.getElementById(mem_table).rows;  // For use in uiUpdate later
  var speed = document.getElementById(speed_field).value;
  var usrInput = document.getElementById(input_box).value;
  var instructions = [];
  currentInstructionAddress = 0;
  usrInput = usrInput.split(/[\r?\n]/g);

  if (inputType == 0){ // Convert assembly code instructions
    // Remove all but letters and numbers
    var quantity = usrInput.length;
    for (let i = 0; i < quantity; i++){
      // Must run through and define labels first (otherwise labels will only be usable for previous instructions)
      usrInput[i] = defineLabels(usrInput[i].toLowerCase());
    }
    for (let i = 0; i < quantity; i++){
      var instStr = replaceLabels(usrInput[i]).replace(/[^A-Z0-9#]/ig, "");
      instructions.push(assToBin(instStr, i));
  }
}
else { // prepare machine code instructions
  var quantity = usrInput.length;
  for (var i = 0; i < quantity; i++){
    var instStr = usrInput[i].replace(/[^0-1]/g, "");
    // Input validation
    if (parseInt(instStr.slice(0, 4), 2) > 15){badInput(instStr.slice(0, 4), i);} // Validate opcode
    else if (parseInt(instStr.slice(4, 6), 2) > 1){badInput(instStr.slice(4, 6), i);} // Validate mode
    else if (parseInt(instStr.slice(6, 14), 2) > 255){badInput(instStr.slice(6, 14), i);} // Validate operand
    // prepare instuctions
    var command = [];
    for (var x = 0; x < 14; x++){
      let commandNum = parseInt(instStr[x], 10);
      command.push(commandNum);
    }
    instructions.push(command);
  }
}
  // Disable start button so program is not interrupted, and enable pause button
  document.getElementById(start_but).disabled = true;
  document.getElementById(pause_but).disabled = false;
  document.getElementById(toggle_expanded).disabled = true;  // Disable 32 bit mode toggle to prevent changing modes while running
  control(instructions, speed); // Start the processor and send instructions to CU
}

function badInput(word, line){ // Input has failed validation
  reporting("Error (line " + line + "): " + word + " is not a valid option");
  throw "Invalid input";
}

function defineLabels(instruction){
  // If there is a label at the start of the instruction, it is a label definition
  // Record the address of the instruction, and then return the instruction with the label removed
  let splitInstruction = instruction.split(" ");
  // Multiple labels may be defined on the same instruction (not useful but user might try it anyway so it makes sense to handle it)
  let i = 0;
  for (; i < splitInstruction.length; i++){
    if(splitInstruction[i][0] === "#"){
      labels[splitInstruction[i]] = currentInstructionAddress;
    }
    else break;
  }
  // Calculate the amount of memory the instruction will use in order to find the address of the next instruction
  if (expanded_memory === true){
    // In 32 bit mode memory use varies by instruction
    if (splitInstruction[i] === allowedInstructions[5][1] || splitInstruction[i] === allowedInstructions[14][1] || splitInstruction[i] === allowedInstructions[15][1]){
      // NOT, INP, and END are always 1 byte
      currentInstructionAddress++;
    }
    else if (splitInstruction[i + 1] === "a" || [allowedInstructions[6][1], allowedInstructions[7][1], allowedInstructions[8][1], allowedInstructions[9][1], allowedInstructions[10][1], allowedInstructions[11][1], allowedInstructions[12][1]].includes(splitInstruction[i])){
      // If addressing mode is A, or the instruction is one that takes an address as operand, then instruction uses 5 bytes
      currentInstructionAddress += 5;
    }
    else if (splitInstruction[i] === allowedInstructions[13][1]){
      // OUT without addressing mode A takes only 1 byte
      currentInstructionAddress++;
    }
    else{
      currentInstructionAddress += 2;
    }
  }
  else{
    currentInstructionAddress += 2;  // Instructions always use 2 bytes in 8 bit mode
  }
  // Return only the portion after the labels
  return splitInstruction.slice(i).join(" ");
}

function replaceLabels(instruction){
  // Replace labels in instruction with the address of the instruction where the label was defined and return the instruction
  // Labels at the end of an instruction should be replaced with the address of the definition
  let splitInstruction = instruction.split(" ");
  for (let i = 0; i < splitInstruction.length; i++){
    if (splitInstruction[i][0] === "#"){
      // It starts with # so is a label
      // The label appears after the instruction, so should be replaced with the actual value for the label
      if (labels[splitInstruction[i]] == undefined) {
        reporting(`Error: Label ${splitInstruction[i]} is not defined`);
        throw "Undefined Label";
      }
      splitInstruction[i] = labels[splitInstruction[i]];
    }
  }
  return splitInstruction.join(" ");
}

function formatEntry(type){
  allowedInstructions = [ // List of instuctions with machine code representation, used to validate and convert assembly to machine code
    ["0000", "add"], ["0001", "sub"], ["0010", "and"], ["0011", "bor"], ["0100", "xor"], ["0101", "not"],
    ["0110", "red"], ["0111", "wrt"], ["1000", "gto"], ["1001", "biz"], ["1010", "bin"], ["1011", "bio"],
    ["1100", "bic"], ["1101", "out"], ["1110", "inp"], ["1111", "end"]
  ];
  getOutputs();
  var inBox = document.getElementById(input_box);
  inBox.disabled = false;
  inBox.value = "";
  document.getElementById(start_but).disabled = false;

  if (type == 0){ // Assembly code
    inputType = 0;
    document.getElementById(inst_conv).style.visibility = "hidden";
  }
  else { // Machine code
    inputType = 1;
    document.getElementById(inst_conv).style.visibility = "visible";
  }
}

function expandMemory(){  // Put processor and UI in 32 bit mode, to allow more memory
  var togglebox = document.getElementById(toggle_expanded);
  var uiABuses = document.getElementsByClassName("address_bus");
  var newABuses = document.getElementsByClassName("Abus_expanded_line");
  var helpBox = document.getElementById(help_table);
  if (document.getElementById(toggle_expanded).checked == true){
    expanded_memory = true;
    start = start_expanded_mode;  // Override default start function with 32 bit one
    document.getElementById(expanded_memory_ui).style.display = "block";  // Enable 32 bit memory UI
    document.getElementById(mem_table).style.display = "none";  // Disable standard (8 bit) memory UI
    // Prepare 32 bit address bus in UI
    for (i = 0; i < uiABuses.length; i++){
      uiABuses[i].style.display = "none";
    }
    for (i = 0; i < newABuses.length; i++){
      newABuses[i].style.display = "grid";
    }
    var tablerow = helpBox.insertRow(-1);  // Add new row to help table
    var helpBttn = document.createElement("a");
    helpBttn.href = "javascript:void(0);";
    helpBttn.addEventListener("click", function(){showHelp("InfoTabIV");});  // Show help pop-up when clicked
    helpBttn.innerText = "32 Bit Mode Help";
    tablerow.insertCell(0).appendChild(helpBttn);  // Add to help table
    widenUIRegisters("widen");  // Widen register displays to fit 32 bit values
  }
  else{
    expanded_memory = false;
    start = default_start_function;  // Set start function back to default one
    document.getElementById(expanded_memory_ui).style.display = "none";  // Disable 32 bit memory UI
    document.getElementById(mem_table).style.display = "table";  // Enable standard (8 bit) memory UI
    for (i = 0; i < uiABuses.length; i++){
      uiABuses[i].style.display = "grid";
    }
    for (i = 0; i < newABuses.length; i++){
      newABuses[i].style.display = "none";
    }
    helpBox.deleteRow(4);  // Remove 32 bit mode help link
    widenUIRegisters("unwiden");  // Return register displays to standard width
  }

}

function widenUIRegisters(option){
  if (option == "widen"){  // Expand registers to be wide enough to display 32 bits
    document.getElementById(program_counter).parentElement.style.width = "230px";
    document.getElementById(memaddr_reg).parentElement.style.width = "230px";
    document.getElementById(memdat_reg).parentElement.style.width = "230px";
    document.getElementById(currinst_reg).parentElement.style.width = "230px";
  }
  else{
    document.getElementById(program_counter).parentElement.style.width = "175px";
    document.getElementById(memaddr_reg).parentElement.style.width = "175px";
    document.getElementById(memdat_reg).parentElement.style.width = "175px";
    document.getElementById(currinst_reg).parentElement.style.width = "175px";
  }
}

function unlimitedClockSpeed(){  // Run clock as fast as browser will allow
  if (event.currentTarget.checked == true){
    unlimitSpeed = true;
    document.getElementById(speed_field).disabled = true;  // Disable clock speed field
    clock = unlimited_clock;  // Override default clock function
  }
  else{
    unlimitSpeed = false;
    document.getElementById(speed_field).disabled = false;  // Enable clock speed field
    clock = default_clock_function;  // Undo override to set clock function back to default
  }
}

function uiUpdate(){
  document.getElementById(program_counter).value = numDisplay(PC.join(""));
  document.getElementById(memaddr_reg).value = numDisplay(MAR.join(""));
  document.getElementById(memdat_reg).value = numDisplay(MDR.join(""));
  document.getElementById(acc_reg).value = numDisplay(ACC.join(""));
  document.getElementById(currinst_reg).value = CIR.join("");
//  document.getElementById(addr_bus).value = numDisplay(ADDRESSBUS.join(""));
//  document.getElementById(dat_bus).value = numDisplay(DATABUS.join(""));
  statUIUpdate();
  busUIUpdate();
}

function memUpdate(addr){ // Update an address in the memory table
  if (expanded_memory == true){
    updateWatch();
  }
  else{
    let row = (parseInt(addr / 16) * 2) + 1;  // *2 and +1 to skip label rows
    let col = addr % 16;
    let table = memUi[row].cells;
    table[col].innerHTML = numDisplay(RAM[addr].join(""));
  }
}

function updateWatch(){  // Update values of addresses being watched in watch table(32 bit mode)
  for (var i in watchlist){
    var memory_value = RAM[i];
    if (typeof memory_value == "undefined"){
      memory_value = "00000000"
    }
    else{
      memory_value = memory_value.join("");
    }
    watchlist[i].innerHTML = numDisplay(memory_value);  // Update value in table
  }
}


function statUIUpdate(){ // Update status bus table
  let tab = document.getElementById(stat_table).rows;
  let row = tab[0].cells;
  row[1].innerHTML = STATUS[0];
  row = tab[1].cells;
  row[1].innerHTML = STATUS[1];
  row = tab[2].cells;
  row[1].innerHTML = STATUS[2];
  row = tab[3].cells;
  row[1].innerHTML = STATUS[3];
}

function cBusUpdate(){ // Update control bus UI
  var uiCBuses = document.getElementsByClassName("control_bus");
  for (var i = 0; i < uiCBuses.length; i++){
    var uiCBus = uiCBuses[i].children;
    if (CONTROLBUS.clock == 1){
      uiCBus[0].style.stroke = "red";
    }
    else {uiCBus[0].style.stroke = "grey";}
    if (CONTROLBUS.request == 1){
      uiCBus[1].style.stroke = "red";
    }
    else {uiCBus[1].style.stroke = "grey";}
    if (CONTROLBUS.grant == 1){uiCBus[2].style.stroke = "red";}
    else {uiCBus[2].style.stroke = "grey";}
    if (CONTROLBUS.write == 1){uiCBus[3].style.stroke = "red";}
    else {uiCBus[3].style.stroke = "grey";}
    if (CONTROLBUS.read == 1){uiCBus[4].style.stroke = "red";}
    else {uiCBus[4].style.stroke = "grey";}
    if (CONTROLBUS.iorequest == 1){uiCBus[5].style.stroke = "red";}
    else {uiCBus[5].style.stroke = "grey";}
    if (CONTROLBUS.iogrant == 1){uiCBus[6].style.stroke = "red";}
    else {uiCBus[6].style.stroke = "grey";}
  }
}


function flagBusUpdate(uiCBus){ // Represent flags[0] in binary
  if (CONTROLBUS.flags[0] > 1){
    uiCBus[5].style.stroke = "red";
  }
  else{
    uiCBus[5].style.stroke = "grey";
  }
  if (CONTROLBUS.flags[0] == 1 || CONTROLBUS.flags[0] == 3){
    uiCBus[6].style.stroke = "red";
  }
  else{
    uiCBus[6].style.stroke = "grey";
  }
}

function busUIUpdate(){ // Update address and data bus UIs
  var uiDBuses = document.getElementsByClassName("data_bus");
  var uiABuses = document.getElementsByClassName("address_bus");
  var uiIOBuses = document.getElementsByClassName("io_bus");

  for (var x = 0; x < uiDBuses.length; x++){
    var uiDBus = uiDBuses[x].children;
    for (var i = 0; i < 8; i++){
      if (DATABUS[i] == 1){
        uiDBus[i].style.stroke = "blue";
      }
      else {
        uiDBus[i].style.stroke = "grey";
      }
    }
  }
  for (var x = 0; x < uiABuses.length; x++){
    var uiABus = uiABuses[x].children;
    for (var i = 0; i < uiABus.length; i++){
      if (ADDRESSBUS[i] == 1){
        uiABus[i].style.stroke = "green";
      }
      else{
        uiABus[i].style.stroke = "grey";
      }
    }
  }
  for (var x = 0; x < uiIOBuses.length; x++){
    var uiIOBus = uiIOBuses[x].children;
    for (var i = 0; i < 8; i++){
      if (IOBUS[i] == 1){
        uiIOBus[i].style.stroke = "orange";
      }
      else{
        uiIOBus[i].style.stroke = "grey";
      }
    }
  }
  cBusUpdate();
}

function queryMemory(){  // Display value of a given memory address (in 32 bit mode)
  var memory_address = document.getElementById(queryAddress).value;
  if (!(isNaN(memory_address) || memory_address == "" || memory_address < 0 || memory_address > 4294967295)){
    var memory_value = RAM[memory_address];
    if (typeof memory_value === "undefined"){
      memory_value = "00000000"
    }
    else{
      memory_value = memory_value.join("");
    }
    document.getElementById(queryOutput).value = memory_value;
  }
  else{
    document.getElementById(queryOutput).value = "Invalid Address";
  }



}

function watchAddress(){  // Watch new address (32 bit mode)
  var memory_address = document.getElementById(watchNewAddress).value;
  if (!(isNaN(memory_address) || memory_address == "" || memory_address < 0 || memory_address > 4294967295 || typeof watchlist[memory_address] !== "undefined")){
    var table = document.getElementById(watchTable);
    if (table.rows[0].cells[0].innerText == "Not watching any addresses"){
      table.deleteRow(0);  // Remove 'not watching any addresses' message
    }
    var tablerow = table.insertRow(-1);  // Create new row
    var address_cell = tablerow.insertCell(0);
    var data_cell = tablerow.insertCell(1);
    var close_cell = tablerow.insertCell(2);
    address_cell.innerHTML = memory_address;  // Display address in first cell
    var closeBtn = document.createElement("a");
    closeBtn.href = "javascript:void(0);";
    closeBtn.addEventListener("click", unWatch);
    closeBtn.innerText = "Remove";
    close_cell.appendChild(closeBtn);
    watchlist[memory_address] = data_cell;  // Add address and corrosponding data cell to watch list
    updateWatch();  // Get value
    document.getElementById(watchNewAddress).value = "";  // Clear input box
  }
  else if (typeof watchlist[memory_address] !== "undefined"){  // The address is already being watched
    document.getElementById(watchNewAddress).value = "Already watching that address";
    document.getElementById(watchNewAddress).addEventListener("click", function replaceValue(){
      event.currentTarget.value = memory_address;  // Replace error message with previous value
      event.currentTarget.removeEventListener("click", replaceValue);  // Remove this event listener
    })
  }
  else{
    document.getElementById(watchNewAddress).value = "Invalid Address";
    document.getElementById(watchNewAddress).addEventListener("click", function replaceValue(){
      event.currentTarget.value = memory_address;  // Replace error message with previous value
      event.currentTarget.removeEventListener("click", replaceValue);  // Remove this event listener
    })
  }
}

function unWatch(event){  // Stop watching an address
  var tablerow = event.currentTarget.parentElement.parentElement;  // Get reference to row in table
  var table = document.getElementById(watchTable);  // Get reference to table
  var memory_address = tablerow.cells[0].innerHTML;  // Get address to be removed
  delete watchlist[memory_address];  // Remove address from watchlist
  table.deleteRow(tablerow.rowIndex);  // Delete row from table
  if (table.rows.length == 0){  // Not watching any addresses
    table.insertRow(0).insertCell(0).innerHTML = "<i>Not watching any addresses</i>";  // Add default message back to table
  }
}




function BusHover(e, info, css){
  e = e || window.event;
  var posX = e.clientX;
  var posY = e.clientY;
  document.getElementById("popupText").innerHTML = info;
  if (info.length > 12){
    document.getElementById("popupBox").style.height = "80px";
  }
  else {
    document.getElementById("popupBox").style.height = "50px";
  }
  document.getElementById("popupBox").style.display = "block";
  highlightBus(css, true);
}

window.onmousemove = function(e){
  var posX = e.clientX;
  var posY = e.clientY;
  document.getElementById("popupBox").style.left = (posX + 20) + "px";
  document.getElementById("popupBox").style.top = (posY + 20) + "px";
}

function highlightBus(css, toggle){
  if (toggle){
    var filtr = "drop-shadow(3px 3px 3px rgb(0, 10, 255))";
  }
  else{
    var filtr = "";
  }
  var uiBuses = document.getElementsByClassName(css);
  for (var i = 0; i < uiBuses.length; i++){
    uiBuses[i].style.filter = filtr;
  }

}


function stopHover(css){
  document.getElementById("popupBox").style.display = "none";
  highlightBus(css, false);
}

function playPause(){ // Allow user to pause and resume CPU while it is running
  if (paused != true){
    document.getElementById(pause_but).value = "Resume";
    pause();
  }
  else{
    document.getElementById(pause_but).value = "Pause";
    resume();
  }
}

function convert(){ // Machine code creator
  getOutputs();
  let convert_Opcode = document.getElementById(conv_opc).value;
  let convert_Mode = document.getElementById(conv_mode).value;
  var convert_Operand = document.getElementById(conv_opr).value;
  convert_Operand = parseInt(convert_Operand, 10);
  convert_Operand = convert_Operand.toString(2);
  let addBits = 8 - convert_Operand.length;
  for (addBits > 0; addBits--;){
    convert_Operand = "0" + convert_Operand;
  }
  let convert_Combine = convert_Opcode + convert_Mode + convert_Operand;
  document.getElementById(conv_out).value = convert_Combine;
}

function convertDisplay(){
  getOutputs();
  if (document.getElementById(show_dec).checked == true){
    showDecimal = true;
    document.getElementById(show_neg).disabled = false;
  }
  else{
    showDecimal = false;
    document.getElementById(show_neg).disabled = true;
  }
  if (document.getElementById(show_neg).checked == true){
    decimalTC = true; // Negative two's complement numbers will be shown as negative
  }
  else{
    decimalTC = false;
  }
  convertUIValues();
}

function convertUIValues(){  // Edit existing binary values on HTML page to display as decimal
  // Convert memory locations
  var memUi = document.getElementById(mem_table).rows;  // In case memUi is not yet defined
  for (var row = 1; row < memUi.length; row = row + 2){  // Iterate through rows containing data
    var cells = memUi[row].cells;
    for (var cell in cells){  // Iterate through cells
      cells[cell].innerHTML = numDisplay(cells[cell].innerHTML);  // Convert to correct format
    }
  }
}

function showHelp(tab){
  if (tab == "close"){
    document.getElementById("helpPopUp").style.zIndex = "-5";
    document.getElementById("helpPopUp").style.display = "none";
    document.getElementById("InfoTabI").style.display = "none";
    document.getElementById("InfoTabII").style.display = "none";
    document.getElementById("InfoTabIII").style.display = "none";
    document.getElementById("InfoTabIV").style.display = "none";
    document.body.style.overflow = "auto";
  }
  else{
    document.getElementById("helpPopUp").style.zIndex = "15";
    document.getElementById("helpPopUp").style.display = "block";
    document.getElementById("InfoTabI").style.display = "none";
    document.getElementById("InfoTabII").style.display = "none";
    document.getElementById("InfoTabIII").style.display = "none";
    document.getElementById("InfoTabIV").style.display = "none";
    document.getElementById(tab).style.display = "block";
    document.body.style.overflow = "hidden";
  }
}

function enlargeX(size){
  var lines = document.getElementsByClassName("exitHelpLine");
  lines[0].style.strokeWidth = size;
  lines[1].style.strokeWidth = size;
}

function numDisplay(num){ // Convert number (if necessary) to decimal
  if (showDecimal){
    if (decimalTC){
      if (num[0] == 1){
        num = num.substr(1);
        num = negateNum(num);
        num = parseInt(num, 2);
        num = num + 1;
        num = "-" + num;
      }
      else{
        num = parseInt(num, 2);
      }
    }
    else {
    num = parseInt(num, 2);
  }
  }

  return num;
}

function negateNum(tmp){
  var outnum = "";
  for (var i = 0; i < 7; i++){
    if (tmp[i] == 0){
      outnum = outnum + "1";
    }
    else{
      outnum = outnum + "0";
    }
  }
  return outnum;
}

function strToBin(str){ // Turn decimal instruction into 8 bit binary string
  str = Number(str).toString(2);
  var tmp = (8 - str.length);
  var prestr = "";
  for (var i = 0; i < tmp; i++){
    prestr = prestr + "0";
  }
  str = prestr.concat(str);
  return str;
}


function endProgram(){  // Prepare UI to allow user to start program again
  document.getElementById(start_but).disabled = false;
  document.getElementById(pause_but).disabled = true;
  document.getElementById(toggle_expanded).disabled = false;
}

function populateSelectModules(){  // Fill drop down menu for possible I/O modules
  var select = document.getElementById(choose_IO);
  for (i in available_modules){
    let option = document.createElement("option")
    option.text = i;
    option.value = i;
    select.add(option);
  }
  changeIOModule(select.value);  // Set first option as default
}

function changeIOModule(io_function){
  // Load I/O module into page
  for (i in available_modules){  // Hide all modules
    document.getElementById(available_modules[i][0]).style.display = "none";
  }
  document.getElementById(available_modules[io_function][0]).style.display = "grid";  // Show selected module
  io_module = available_modules[io_function][1];
}

function start_expanded_mode(){
  function assToBin(word, line){ // Convert assembly instructions to machine code
    var opc = word.slice(0, 3);
    //var mode = word.slice(3, 4);
    var opr = word.slice(4, 36);  // Instruction can be maximum of 36 chars
    // Convert opcode
    var permitted = false;
    for (var i = 0; i < 16; i++){
      if (allowedInstructions[i][1] == opc){
        opc = allowedInstructions[i][0];
        permitted = true;
        break;
      }
    }
    if (permitted == false){
      badInput(opc, line);
    }

    // Convert addressing mode
    // Get addressing mode
    var mode = word.slice(3, 4);
    if (mode == "d" || mode == "a"){
      // Do nothing, mode is fine
    }
    else{
      mode = "d";
      // No value, or invalid value given, assume mode is D
    }
    // Convert addressing mode to binary
    if (mode == "a"){
      mode = "1";
    }
    else if (mode == "d"){
      mode = "0";
    }
    else {
      badInput(mode, line)
    }
    // Get operand
    word = word.replace(/[^0-9]/g, ""); // Remove any non numerical chars to leave only operand
    var wdlen = word.length;
    if (wdlen <= 0){
      if (opc == allowedInstructions[5][0] || opc == allowedInstructions[13][0]
      || opc == allowedInstructions[14][0] || opc == allowedInstructions[15][0]){ // Opcode is not, out, inp or end (does not require operand)
        word = "none";
      }
      else{
        badInput(word, line) // Operand is not given
    }
    }
    opr = word;

    // Convert operand to binary
    if (Number(opr) < 4294967296){
      opr = Number(opr).toString(2);
      // If the operand is an address (if mode is A or the instruction takes an address as data e.g. GTO) then the operand will use 4 bytes, else it will use 1
      if (mode == "1" || [allowedInstructions[6][0], allowedInstructions[7][0], allowedInstructions[8][0], allowedInstructions[9][0], allowedInstructions[10][0], allowedInstructions[11][0], allowedInstructions[12][0]].includes(opc)){
        // Right pad to 32 bits
        opr = opr.padStart(32, "0");
        var oprLength = "100";
        currentInstructionAddress += 5;  // Instruction uses 5 bytes in memory
      }
      else{
        // Right pad to 8 bits
        opr = opr.padStart(8, "0");
        var oprLength = "001";
        currentInstructionAddress += 2;  // Instruction uses 2 bytes in memory
      }
    }
    else if (word === "none"){
      // There is no operand, as the opcode does not need one
      var oprLength = "000";
      opr = "";
      currentInstructionAddress += 1;  // Instruction uses 1 byte in memory
    }
    else{
      badInput(opr, line);
    }
    // Combine into one machine instruction
    word = opc.concat(mode, oprLength, opr);
    var command = [];
    for (var i = 0; i < word.length; i++){
      command.push(word[i]);
    }
    return command;
  }

  memUi = document.getElementById(mem_table).rows;  // For use in uiUpdate later
  var speed = document.getElementById(speed_field).value;
  var usrInput = document.getElementById(input_box).value;
  var instructions = [];
  currentInstructionAddress = 0;
  usrInput = usrInput.split(/[\r?\n]/g);

  if (inputType == 0){ // Convert assembly code instructions
    // Remove all but letters and numbers
    var quantity = usrInput.length;
    for (let i = 0; i < quantity; i++){
      // Must run through and define labels first (otherwise labels will only be usable for previous instructions)
      usrInput[i] = defineLabels(usrInput[i].toLowerCase());
    }
    for (let i = 0; i < quantity; i++){
      var instStr = replaceLabels(usrInput[i]).replace(/[^A-Z0-9#]/ig, "");
      instructions.push(assToBin(instStr, i));
  }
}
else { // prepare machine code instructions
  var quantity = usrInput.length;
  for (var i = 0; i < quantity; i++){
    var instStr = usrInput[i].replace(/[^0-1]/g, "");
    // Input validation
    if (parseInt(instStr.slice(0, 4), 2) > 15){badInput(instStr.slice(0, 4), i);} // Validate opcode
    else if (parseInt(instStr.slice(4, 5), 2) > 1){badInput(instStr.slice(4, 5), i);} // Validate mode
    else if(parseInt(instStr.slice(5,8), 2) > 4){badInput(instStr.slice(5,8), i)}  // Validate operand length
    else if (parseInt(instStr.slice(8), 2) > 4294967295){badInput(instStr.slice(8), i);} // Validate operand
    // prepare instuctions
    var command = [];
    for (var x = 0; x < instStr.length; x++){
      let commandNum = parseInt(instStr[x], 10);
      command.push(commandNum);
    }
    instructions.push(command);
  }
}
  // Disable start button so program is not interrupted, and enable pause button
  document.getElementById(start_but).disabled = true;
  document.getElementById(pause_but).disabled = false;
  document.getElementById(toggle_expanded).disabled = true;  // Disable 32 bit mode toggle to prevent changing modes while running
  control(instructions, speed); // Start the processor and send instructions to CU
}

var default_start_function = start;  // Create global reference to default starter function for use in changing back from 32 bit mode
