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
    // Global area is the "stack frame" for global scope (it isn't really on the stack, but is structured the same as a normal stack frame)
    "GlobalArea": 36,
}
// Positions of important memory addresses within structures (e.g. frames, tables)
const offsets = {
    "frame": {
        "EvalTopPointer": 0,
        "EvalStartPointer": 4,
        "StartChunkPointer": 8,
        "StartChunkEndPointer": 12,
        "LastChunkStartPointer": 16,
        "HeapEndPointer": 20,
        "PreviousFramePointer": 24,
        "ReturnPointer": 28,
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
        // Initialise global area
    ]);
    
}