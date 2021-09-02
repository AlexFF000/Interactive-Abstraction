/*
    Provides functions for use in tests
*/

var breakInstructionAddresses = [];  // List of addresses (as ints) of instructions to pause on if breakInstructions have been turned on

async function runTests(tests){
    // Takes list of test functions, and runs them, reporting the results of each
    let passed = 0;
    for (let t of tests){
        try{
            let result = await t();
            if (result === true){
                passed++;
                console.log(`${t.name}: PASS`);
            }
            else console.log(`${t.name}: FAIL: ${result}`);
        }
        catch (e){
            console.log(`${t.name}: ERROR: ${e}`);
        }
    }
    console.log(`${passed}/${tests.length} passed`);
}

function assertMemoryEqual(expected, addressOfActual, noOfBytes){
    // Check if the values in the memory addresses starting at addressOfActual are equal to the corresponding bytes of expected
    // expected should be an array of arrays (each containing a byte in the same format as the memory), addressOfActual should be an int representing a memory address
    try{
        for (let i = 0; i < noOfBytes; i++){
            if (!ArraysEqual(expected[i], readMemory(addressOfActual + i))) return "Assertion Error: Values do not match";
        }
        return true;
    }
    catch (e){
        return e;
    }
}

function assertMemoryEqualToInt(expected, addressOfActual, noOfBytes){
    // Same as assertMemoryEqual but takes an integer for expected
    let binArray = [];
    for (let i = 0; i < noOfBytes; i++){
        binArray.push(intToBinArray(getByteOfInt(expected, i)));
    }
    return assertMemoryEqual(binArray, addressOfActual, noOfBytes);
}

function readMemory(address){
    // Return the value from the given memory address as a an array of ints representing bits
    let byte = RAM[address];
    // Check the address is allowed
    if (!((0 <= address && address <= 255) || (expanded_memory && 0 <= address && address <= 4294967295))){
        throw "Assertion Error: Cannot read invalid memory address";
    }
    if (byte == undefined){
        // Addresses that are 0 are undefined in 32 bit mode to save space
        return [0,0,0,0,0,0,0,0]
    }
    else return byte;
}

function readMemoryAsInt(address, bytes){
    // Read the given number of bytes from memory, starting from address, and then return them as an int
    let binArray = [];
    for (let i = 0; i < bytes; i++) binArray.push(readMemory(address + i));
    return binArrayToInt(binArray);   
}

function writeMemory(value, address){
    // Write an array of eight 1 and 0's representing bits, to the given memory address
    // Check the address is allowed
    if (!((0 <= address && address <= 255) || (expanded_memory && 0 <= address && address <= 4294967295))){
        throw "Invalid memory address";
    }
    if (expanded_memory && ArraysEqual(value, [0,0,0,0,0,0,0,0])){
        delete RAM[address];
    }
    else{
        RAM[address] = value;
    } 
}

function writeIntToMemory(integer, address, bytes){
    // Write the integer to the bytes starting at the given address
    for (let i = 0; i < bytes; i++){
        writeMemory(intToBinArray(getByteOfInt(integer, i)), address + i);
    }
}

function getByteOfInt(integer, byte){
    // Return the value of the byte at the specified position for the given integer (big endian)
    // Shift right until desired byte is in least significant position, then AND with 255 to extract the value of only that byte
    shifts = (3 - byte) * 8;
    shifted = integer >> shifts;
    return shifted & 255;
}

function intToBinArray(integer){
    // Convert integer between 0 and 255 to array of 1s and 0s
    let output = [];
    let divisionResult = integer;
    for (let i = 0; i < 8; i++){
        divisionResult = divisionResult / 2;
        let floored = Math.floor(divisionResult);
        // Get remainder and insert at start of output
        output.unshift((divisionResult - floored) * 2);
        divisionResult = floored;
    }
    return output;
}

function binArrayToInt(binArray){
    // Takes array of 1s and 0s and converts to an (unsigned) integer
    // Can take array of any length, and also allows 2d arrays with subarrays for each byte
    binArray = binArray.flat();
    let value = 0;
    for (let i = 0; i < binArray.length; i++){
        value += (2 ** i) * binArray[(binArray.length - 1) - i];
    }
    return value;
}

function ArraysEqual(array1, array2){
    // Check if two 1D arrays are identical
    if (array1.length != array2.length) return false;
    for (let i = 0; i < array1.length; i++){
        if (array1[i] !== array2[i]) return false;
    }
    return true;
}

function initialiseCPU(){
    // Initialise the memory, registers, and buses (in 32 bit mode) without starting the CPU
    document.getElementById(toggle_expanded).checked = true;
    expandMemory();
    initMem();
    initBus();
    initReg();
}

function runInstructions(instructions, resetCPU=true, addEndInstruction=false){
    // Places the given machine code instructions into the assembler and starts the CPU in 32 bit mode (this works in the same way as pasting them in to the instruction area and pressing start)
    // Returns a promise, which will resolve when the CPU finishes
    // instructions should be an array of strings, each containing one instruction
    // If resetCPU is false, the existing memory, registers etc... won't be cleared before running
    // This function largely works by manipulating UI elements.  This is mainly because the CPU code for loading instructions and starting the CPU is old and tightly integrated with the UI code.  Though it also has the small benefit that this function will work in almost exactly the same way as an actual user entering the instructions.

    if (resetCPU === false){
        // Override the initialisation functions to prevent re-initialisation
        var initMem_original = initMem;
        var initBus_original = initBus;
        var initReg_original = initReg;
        initMem = () => {
            // If already initialised, don't do it again
            if (RAM === undefined) initMem_original();
        };
        initBus = () => {
            if (CONTROLBUS == undefined || DATABUS == undefined || ADDRESSBUS == undefined) initBus_original();
        };
        initReg = () => {
            if (PC == undefined || MAR == undefined || MDR == undefined || CIR == undefined || ACC == undefined || STATUS == undefined) initReg_original();
            else PC = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];  // PC must always be cleared
        }
    }
    if (addEndInstruction === true) instructions = instructions.concat("END");
    // Set up promise, placing its resolve function in onEndCallback
    let onEndPromise = new Promise((resolve, reject) => {
        onEndCallback = () => {
            if (resetCPU === false){
                // Restore original functions
                initMem = initMem_original;
                initBus = initBus_original;
                initReg = initReg_original;
            }
            resolve();
        };
    });
    // Set input mode to assembly
    formatEntry(0);
    // Set unlimited clock speed
    if (document.getElementById("toggle_clock_speed").checked == false){
        document.getElementById("toggle_clock_speed").click();
    }
    // Set 32 bit mode
    document.getElementById(toggle_expanded).checked = true;
    expandMemory();
    // Load instructions into instruction area
    let text = instructions.join("\n");
    document.getElementById(input_box).value = text;
    document.getElementById(start_but).click();
    return onEndPromise;
}

function runSetup(){
    // Run the setup procedure
    let code = IntermediateFunctions["SETUP"]();
    code.push("END");  // END instruction must be added here rather than by runInstructions, as otherwise calculateReplacementVariables will have the wrong length
    calculateReplacementVariables(code);
    performReplacements(code, replacements, replacementVariables);
    return runInstructions(code);
}

function listInstructionAddresses(instructions, lastPreviousAddress){
    // Take a list of assembly code instructions, and prefix each with the memory location that it will be stored (useful for debugging)
    let newInstructions = [];
    for (let i = 0; i < instructions.length; i++){
        let newInstruct = `(${lastPreviousAddress}) ${instructions[i]}`;
        lastPreviousAddress += calculateInstructionsLength([instructions[i]]);
        newInstructions.push(newInstruct);
    }
    return newInstructions;
}

var instructions_fetched = [];  // Ordered list of addresses of all instructions that have been fetched
var original_fetch = fetch;  // Store reference to original fetch function, as toggleBreakInstructions overrides it
function toggleBreakInstructions(breakInstructions){
    // Allow the CPU to be paused when fetching instructions from addresses in breakInstructionAddresses
    if (breakInstructions === true){
        // Override fetch function to enable breakpoints
        fetch = () => {
            let currentAddr = binArrayToInt(PC);
            instructions_fetched.push(currentAddr);
            if (breakInstructionAddresses.includes(currentAddr)){
                // The current instruction is included in the list of instructions to pause on
                console.log(`Paused on ${currentAddr}`);
                paused = true;
                queue = [];
            }
            else{
                original_fetch();
            }
        };
        return "Turned on break instructions";
    }
    else{
        // Set fetch back to the orignal fetch function
        fetch = original_fetch;
        return "Turned off break instructions";
    }
}

function resumeBreakInstruction(){
    // Resume after pausing on break instruction
    original_fetch();
    paused = false;
    clock();
}