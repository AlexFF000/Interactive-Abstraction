/*
    Provides functions for use in tests
*/

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

function ArraysEqual(array1, array2){
    // Check if two 1D arrays are identical
    if (array1.length != array2.length) return false;
    for (let i = 0; i < array1.length; i++){
        if (array1[i] !== array2[i]) return false;
    }
    return true;
}

function runInstructions(instructions){
    // Places the given machine code instructions into the assembler and starts the CPU in 32 bit mode (this works in the same way as pasting them in to the instruction area and pressing start)
    // Returns a promise, which will resolve when the CPU finishes
    // instructions should be an array of strings, each containing one instruction
    // This function largely works by manipulating UI elements.  This is mainly because the CPU code for loading instructions and starting the CPU is old and tightly integrated with the UI code.  Though it also has the small benefit that this function will work in almost exactly the same way as an actual user entering the instructions.

    // Set up promise, placing its resolve function in onEndCallback
    let onEndPromise = new Promise((resolve, reject) => {
        onEndCallback = resolve;
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