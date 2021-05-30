// Data is stored in big-endian format

// Important memory addresses (for data that use multiple addresses, this contains the first address)
const Addresses = {
    "StackSize": 5,
    "StackStart": 9,
    "StackPointer": 13,
    "ScopePointer": 17,
    // Pointers for the int/float pool
    "PoolStartPointer": 21,
    "PoolFreePointer": 25,
    // The address that null values point to
    "NullAddress": 33,
    // 1 byte value used when traversing variable tables.  Set if all tables so far have been accessed through the parent or "this" attribute (used to enforce private keyword)
    "AllParents": 34,
    // 1 byte value used as flags for representing access modifiers for a new variable
    "Modifiers": 35,
    // 1 byte value set when global keyword used (indicates next variable must be created in global scope)
    "DeclareGlobal": 36,
    /* 
        The pseudo registers are a set of 4 byte areas in memory used to temporarily hold data that is being worked on (this avoids the need to allocate memory for minor operations like addition, subtraction etc...) 
        These are useful as the only usable "hardware" register is the accumulator, which is only 8 bits.  But we will usually be working with 32 bits.
    */
    "ps0": 37,
    "ps1": 41,
    "ps2":45,
    "ps3": 49,
    // Global area is the "stack frame" for global scope (it isn't really on the stack, but is structured the same as a normal stack frame)
    "GlobalArea": 53,
    // The buddy allocation system used for the global heap is inefficient for very small objects like ints and floats, so a dedicated pool is used for ints and floats in the global scope
    "IntFloatPool": null,
    // The start address of first instruction to be run in global scope
    "FirstInstruction": null,
}
// Positions of important memory addresses within structures (e.g. frames, tables)
const Offsets = {
    "frame": {
        // Pointers to important locations

        "EvalTopPointer": 0,
        "StartChunkPointer": 4,
        "StartChunkEndPointer": 8,
        "LastChunkStartPointer": 12,
        "HeapEndPointer": 16,
        "PreviousFramePointer": 20,
        "ReturnPointer": 24,
        // A pointer to the first instruction in the frame is needed for calculating return addresses when calling other functions (as the value of Program Counter cannot be read using an instruction)
        "FirstInstructionPointer": 28,
        // Locations of structures in the frame

        // The start of the evaluation stack
        "EvalStart": 28,
        
    }
}

/*
    Certain instructions will need data that isn't ready until compilation is complete (e.g. the number of instructions in the program)
    So they are given placeholder values which will be replaced later, and the details of the instruction are placed in replacements so the compiler knows to replace it later
    The format for this is [<Name of variable to replace with>, <Position of instruction in assemblyCode>, <String containing the instruction, with a "#" symbol to be replaced by the actual value>]
*/
var replacements = [];

function registerReplacement(varToReplaceWith, instructionIndex, instruction){
    // Adds the instruction to replacements and returns a suitable placeholder
    replacements.push([varToReplaceWith, instructionIndex, instruction]);
    return instruction;
}

// Scan intermediateCode and generate assembly code instructions
var assemblyCode = []

function generate_code(intermediates){
    
}

function calculateInstructionsLength(instructions){
    // Calculate how many bytes a list of instructions will use (as instructions in 32 bit mode are variable length)
    let length = 0;
    for (let i = 0; i < instructions.length; i++){
        let currentInstruction = instructions[i].split(" ");
        if (["RED", "WRT", "GTO", "BIZ", "BIN", "BIO", "BIC"].includes(currentInstruction[0]) === false && currentInstruction[1] !== "A"){
            // This is not an instruction that can take an address as data, and the addressing mode is not Address.  Therefore this instruction will always be 2 bytes
            length += 2;
        }
        else{
            // The data is an address, so may use 1-4 bytes
            let operand;
            if (currentInstruction[1] === "A" || currentInstruction[1] === "D"){
                // The addressing mode was explicitly provided, so the operand will be in currentInstruction[2]
                operand = Number(currentInstruction[2]);
            }
            else{
                // The addressing mode was not explicitly provided
                operand = Number(currentInstruction[1]);
            }
            // 1 byte for opcode, addressing mode, and operand length, at least 1 byte for operand
            length += 2;
            if (256 <= operand) length++;
            else continue;
            if (65536 <= operand) length++;
            else continue;
            if (16777216 <= operand) length++;
        }
    }
    return length;
}

function getByte(integer, byte){
    // Return the value of the byte at the specified position for the given integer (big endian)
    // Shift right until desired byte is in least significant position, then AND with 255 to extract the value of only that byte
    shifts = (3 - byte) * 8;
    shifted = integer >> shifts;
    return shifted & 255;
}

function writeMultiByte(value, address, addressesNeeded){
    // Return a list of instructions to write value to addresses starting from address
    let instructs = [];
    for (let i = 0; i < addressesNeeded; i++){
        // Add and write, one byte at a time
        let byteValue = getByte(value, i);
        instructs.push(`ADD ${byteValue}`);
        instructs.push(`WRT ${address + i}`);
        // And with 0 so accumulator is clear ready for next instruction
        instructs.push("AND 0");
    }
    return instructs;
}

function copy(srcAddress, dstAddress, bytes){
    // Return a list of instructions to copy specified number of bytes from source starting at srcAddress to destination starting at dstAddress
    let instructs = [];
    for (let i = 0; i < bytes; i++){
        instructs.push(`ADD A ${srcAddress + i}`);
        instructs.push(`WRT ${dstAddress + i}`);
        // Clear ACC ready for next instruction
        instructs.push("AND 0");
    }
    return instructs;
}

function add32BitIntegers(int1, int2, instructionIndex, int1IsLiteral=false, int2IsLiteral=false){
    // Return list of instructions to add the two 32 bit integers from the given addresses (unless they are literals), and leave the result in ps3
    // instructionIndex is the position in assemblyCode that will contain the first of the instructions generated by this function
    let instructs = [];
    // First load the operands into ps0 and ps1 if they are literals
    if (int1IsLiteral){
        instructs = writeMultiByte(int1, Addresses.ps0, 4);
        int1 = Addresses.ps0;
    }
    if (int2IsLiteral){
        instructs = instructs.concat(writeMultiByte(int2, Addresses.ps1, 4));
        int2 = Addresses.ps1;
    }
    instructs.push(
        // ps2 is used to hold carry flags, so make sure it is clear
        "AND 0",
        `WRT ${Addresses.ps2 + 1}`,
        `WRT ${Addresses.ps2 + 2}`,
        `WRT ${Addresses.ps2 + 3}`,
        // Start adding one byte at a time, starting from LSB
        // First byte (LSB)
        `RED ${int1 + 3}`,
        `ADD A ${int2 + 3}`,
        `WRT ${Addresses.ps3 + 3}`);
        // Check if there is a carry
    instructs.push(
        `BIC ${carryB}`,
        // Second byte
        `RED ${int1 + 2}`,
        `ADD A ${int2 + 2}`
        `WRT ${Addresses.ps3 + 2}`,
        // Carry for this byte must be checked before adding carry from previous, otherwise carry will be wiped
        `BIC ${carryByte2(Work out later)}`,
        // Add carry for first byte (if there was one)
        `RED ${Addresses.ps3 + 2}`,
        `ADD A ${Addresses.ps2 + 3}`,
        `WRT ${Addresses.ps3 + 2}`,
        // Third byte
        `RED ${int1 + 1}`,
        `ADD A ${int2 + 1}`,
        `WRT ${Addresses.ps3 + 1}`,
        `BIC ${carryByte3(Work out later)}`,
        `RED ${Addresses.ps3 + 1}`,
        `ADD A ${Addresses.ps2 + 2}`,
        `WRT ${Addresses.ps3 + 1}`,
        // Fourth byte
        `RED ${int1}`,
        `ADD A ${int2}`,
        `ADD A ${Addresses.ps2 + 1}`
    );
    // Instructions for handling carries
    instructs.push(
        // Carry for LSB
        "AND 0",
        "ADD 1",
        `WRT ${Addresses.ps2 + 3}`,
        `GTO ${byte2(Work out later)}`,
        // Carry for second byte
        "AND 0",
        "ADD 1",
        `WRT ${Addresses.ps2 + 2}`,
        `GTO ${byte3(Work out later)}`,
        // Carry for third byte
        "AND 0",
        "ADD 1",
        `WRT ${Addresses.ps2 + 1}`,
        `GTO ${byte4(Work out later)}`
    );
    

}

function SETUP(){
    // Setup the runtime environment
    // Start loading values into reserved area
    assemblyCode = assemblyCode.concat(
        writeMultiByte(runtime_options.StackSize, Addresses.StackSize, 4)
    );
    // Load location of start of stack into reserved area.  This won't be known until all instructions are compiled
    assemblyCode = assemblyCode.concat([
        registerReplacement("InstructionsEndAddress[0]", assemblyCode.length, "ADD #"),
        `WRT ${Addresses.StackStart}`,
        // Also write same values to StackPointer, as it will initially be the same as stack start (as the stack is empty)
        `WRT ${Addresses.StackPointer}`,
        "AND 0",
        registerReplacement("InstructionEndAddess[1]", assemblyCode.length + 3, "ADD #"),
        `WRT ${Addresses.StackStart + 1}`,
        `WRT ${Addresses.StackPointer + 1}`,
        "AND 0",
        registerReplacement("InstructionsEndAddress[2]", assemblyCode.length + 6, "ADD #"),
        `WRT ${Addresses.StackStart + 2}`,
        `WRT ${Addresses.StackPointer + 2}`,
        "AND 0",
        registerReplacement("InstructionsEndAddress[3]", assemblyCode.length + 9, "ADD #"),
        `WRT ${Addresses.StackStart + 3}`,
        `WRT ${Addresses.StackPointer + 3}`,
        "AND 0",
    ]);
    // Set initial scope to global
    assemblyCode = assemblyCode.concat(
        writeMultiByte(Addresses.GlobalArea, Addresses.ScopePointer, 4)
    );
    // Make sure certain memory addresses are cleared
    assemblyCode.concat([
        `WRT ${Addresses.NullAddress}`,
        `WRT ${Addresses.AllParents}`,
        `WRT ${Addresses.Modifiers}`,
        `WRT ${Addresses.DeclareGlobal}`,
    ]).concat(
        // Initialise global area
        // Point EvalTop pointer to start of eval stack as there is nothing on it yet
        writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.GlobalArea + Offsets.frame.EvalTopPointer, 4),
        // As this is global, there is no return address or previous frame.  So set return and previous frame pointers to point to null
        writeMultiByte(Addresses.NullAddress, Addresses.GlobalArea + Offsets.frame.PreviousFramePointer, 4),
        writeMultiByte(Addresses.NullAddress, Addresses.GlobalArea + Offsets.frame.ReturnPointer, 4),
        // Global heap uses a different allocation system to normal frames, so LastChunkStart is not needed so set that to null as well
        writeMultiByte(Addresses.NullAddress, Addresses.GlobalArea + Offsets.frame.LastChunkStartPointer, 4),
        writeMultiByte(Addresses.FirstInstruction, Addresses.GlobalArea + Offsets.frame.FirstInstructionPointer, 4),

        // Setup int / float pool
        
    )
    
}