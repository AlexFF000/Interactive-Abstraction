const IntermediateFunctions = {
    "SETUP": SETUP,
}

// Data is stored in big-endian format

// Positions of important memory addresses within structures (e.g. frames, tables)
const Offsets = {
    "frame": {
        // Pointers to important locations

        "EvalTopPointer": 0,
        "StartChunkPointer": 4,
        "StartChunkEndPointer": 8,
        "LastChunkStartPointer": 12,
        "HeapStartPointer": 16,
        "HeapEndPointer": 20,
        "PreviousFramePointer": 24,
        "ReturnPointer": 28,
        // A pointer to the first instruction in the frame is needed for calculating return addresses when calling other functions (as the value of Program Counter cannot be read using an instruction)
        "FirstInstructionPointer": 32,
        // Locations of structures in the frame

        // The start of the evaluation stack
        "EvalStart": 36,
        
    }
}

// Important memory addresses (for data that use multiple addresses, this contains the first address)
// Reserved area contains the stack, important pointers and data, and a stack frame for the global scope.  It goes at the end of memory so its position can always be known at compile time while allowing the instructions to be placed at the start of memory.
var reservedArea = (runtime_options.MemorySize - 1) - (runtime_options.StackSize + runtime_options.EvalStackSize + runtime_options.IntFloatPoolSize + 41)
const Addresses = {
    "StackPointer": reservedArea,
    "ScopePointer": reservedArea + 4,
    // Details of the Evaluation Stack of the current stack frame (quicker to store these globally as they will be used very regularly)
    "EvalTop": reservedArea + 8,  // Pointer to the top item on the EvalStack
    "EvalSlotsUsed": reservedArea + 12,  // 1 byte counter recording number of items on the eval stack (used to check if it is full or empty)
    // Free pointer for the int/float pool
    "PoolFreePointer": reservedArea + 13,
    // The address that null values point to
    "NullAddress": reservedArea + 17,
    // 1 byte value used when traversing variable tables.  Set if all tables so far have been accessed through the parent or "this" attribute (used to enforce private keyword)
    "AllParents": reservedArea + 18,
    // 1 byte value used as flags for representing access modifiers for a new variable
    "Modifiers": reservedArea + 19,
    // 1 byte value set when global keyword used (indicates next variable must be created in global scope)
    "DeclareGlobal": reservedArea + 20,
    /* 
        The pseudo registers are a set of 4 byte areas in memory used to temporarily hold data that is being worked on (this avoids the need to allocate memory for minor operations like addition, subtraction etc...) 
        These are useful as the only usable "hardware" register is the accumulator, which is only 8 bits.  But we will usually be working with 32 bits.
    */
    "ps0": reservedArea + 21,
    "ps1": reservedArea + 25,
    "ps2":reservedArea + 29,
    "ps3": reservedArea + 33,
    // Pseudo register specifically for manipulating addresses, useful for pointers
    "psAddr": reservedArea + 37,
    // Global area is the "stack frame" for global scope (it isn't really on the stack, but is structured the same as a normal stack frame)
    "GlobalArea": reservedArea + 41,
    // The stack starts immediately after the global area
    "StackStart": reservedArea + 41 + Offsets.frame.EvalStart + runtime_options.EvalStackSize,
    // The buddy allocation system used for the global heap is inefficient for very small objects like ints and floats, so a dedicated pool is used for ints and floats in the global scope
    "IntFloatPool": reservedArea + 41 + Offsets.frame.EvalStart + runtime_options.EvalStackSize + runtime_options.StackSize,
}


/*
    Certain instructions will need data that isn't ready until compilation is complete (e.g. the number of instructions in the program)
    So they are given placeholder values which will be replaced later, and the details of the instruction are placed in replacements so the compiler knows to replace it later
    The format for this is [<Name of variable to replace with>, <Position of instruction in assemblyCode>, <String containing the instruction, with a "#" symbol to be replaced by the actual value>]
*/
var replacements = [];
var replacementVariables = {};

function registerReplacement(varToReplaceWith, instructionIndex, instruction){
    // Adds the instruction to replacements and returns a suitable placeholder
    replacements.push([varToReplaceWith, instructionIndex, instruction]);
    return instruction;
}

// Scan intermediateCode and generate assembly code instructions
var assemblyCode = [];

function generate_code(intermediates){
    for (let i = 0; i < intermediates.length; i++){
        IntermediateFunctions[intermediates[i][0]](intermediates[i][1]);
    }
    calculateReplacementVariables();
    performReplacements(assemblyCode, replacements, replacementVariables);
}

function calculateReplacementVariables(){
    // Calculate variables to be used for replacements (only works once code has been compiled)
    // InstructionsEndAddress (the first address following the end of global instructions)
    let instructionsEndAddr = calculateInstructionsLength(assemblyCode);
    replacementVariables["InstructionsEndAddress"] = instructionsEndAddr;
    replacementVariables["InstructionsEndAddress[0]"] = getByte(instructionsEndAddr, 0);
    replacementVariables["InstructionsEndAddress[1]"] = getByte(instructionsEndAddr, 1);
    replacementVariables["InstructionsEndAddress[2]"] = getByte(instructionsEndAddr, 2);
    replacementVariables["InstructionsEndAddress[3]"] = getByte(instructionsEndAddr, 3);
    
    // Calculate Heap details
    let heapSizeBase2 = Math.floor(Math.log2((reservedArea - 1) - instructionsEndAddr));
    replacementVariables["HeapSizeBase2"] = heapSizeBase2;
    let heapEndAddress = instructionsEndAddr + 2 ** heapSizeBase2;
    replacementVariables["HeapEndAddress"] = heapEndAddress;
    replacementVariables["HeapEndAddress[0]"] = getByte(heapEndAddress, 0);
    replacementVariables["HeapEndAddress[1]"] = getByte(heapEndAddress, 1);
    replacementVariables["HeapEndAddress[2]"] = getByte(heapEndAddress, 2);
    replacementVariables["HeapEndAddress[3]"] = getByte(heapEndAddress, 3);
}

function performReplacements(intermediates, requestedReplacements, variables){
    // Perform requested replacements once variables to replace with have been calculated
    for (let i = 0; i < requestedReplacements.length; i++){
        let replaceWith = requestedReplacements[i][0];
        let instructionPos = requestedReplacements[i][1];
        let instruction = requestedReplacements[i][2];
        intermediates[instructionPos] = instruction.replace("#", variables[replaceWith]);
    }
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
            // The data is an address, so will always take 4 bytes.  So instruction will always be 5 bytes
            length += 5 
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

function copyFromAddress(dstAddress, bytes, instructionsLength){
    // Return a list of instructions to copy specified number of bytes from source starting at the address in psAddr to destination starting at dstAddress
    let instructs = [];
    for (let i = 0; i < bytes; i++){
        if (i != 0){
            // Increment psAddr to get the address of next byte
            instructs = instructs.concat(incrementAddress(instructionsLength + calculateInstructionsLength(instructs)));
        }
        instructs.push(`RED A ${Addresses.psAddr}`);
        instructs.push(`WRT ${dstAddress + i}`);
    }
    return instructs;
}

function add32BitIntegers(int1, int2, instructionsLength, int1IsLiteral=false, int2IsLiteral=false){
    // Return list of instructions to add the two 32 bit integers from the given addresses (unless they are literals), and leave the result in ps3
    // instructionLength is the number of bytes that will be used by the existing instructions in assemblyCode
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
        `WRT ${Addresses.ps3 + 3}`
        );
    instructionsLength += calculateInstructionsLength(instructs);
    instructs.push(
        // Check for carry
        `BIC ${instructionsLength + 95}`,  // Each of these instructions uses 5 bytes, so +95 will give address of first instruction in first byte carry procdure
        // Second byte
        `RED ${int1 + 2}`,
        `ADD A ${int2 + 2}`,
        `WRT ${Addresses.ps3 + 2}`,
        // Carry for this byte must be checked before adding carry from previous, otherwise carry will be wiped
        `BIC ${instructionsLength + 109}`,
        // Add carry for first byte (if there was one)
        `RED ${Addresses.ps3 + 2}`,
        `ADD A ${Addresses.ps2 + 3}`,
        `WRT ${Addresses.ps3 + 2}`,
        // Third byte
        `RED ${int1 + 1}`,
        `ADD A ${int2 + 1}`,
        `WRT ${Addresses.ps3 + 1}`,
        `BIC ${instructionsLength + 123}`,
        `RED ${Addresses.ps3 + 1}`,
        `ADD A ${Addresses.ps2 + 2}`,
        `WRT ${Addresses.ps3 + 1}`,
        // Fourth byte
        `RED ${int1}`,
        `ADD A ${int2}`,
        `ADD A ${Addresses.ps2 + 1}`,
        // Skip over carry procedures
        `GTO ${instructionsLength + 137}`
    );
    // Instructions for handling carries.  These just store 1 in the appropriate byte of ps2
    instructs.push(
        // Carry for LSB
        "AND 0",
        "ADD 1",
        `WRT ${Addresses.ps2 + 3}`,
        `GTO ${instructionsLength + 5}`,
        // Carry for second byte
        "AND 0",
        "ADD 1",
        `WRT ${Addresses.ps2 + 2}`,
        `GTO ${instructionsLength + 25}`,
        // Carry for third byte
        "AND 0",
        "ADD 1",
        `WRT ${Addresses.ps2 + 1}`,
        `GTO ${instructionsLength + 65}`
    );
    return instructs;
}

function incrementAddress(instructionsLength){
    // Increment the value in psAddr by 1
    return [
        // Add 1 to LSB, and only modify the other bytes if there is a carry
        `RED ${Addresses.psAddr + 3}`,
        "ADD 1",
        `WRT ${Addresses.psAddr + 3}`,
        `BIC ${instructionsLength + 22}`,
        `GTO ${instructionsLength + 78}`,
        // There is a carry so also need to add 1 to next byte
        `RED ${Addresses.psAddr + 2}`,
        "ADD 1",
        `WRT ${Addresses.psAddr + 2}`,
        `BIC ${instructionsLength + 44}`,
        `GTO ${instructionsLength + 78}`,
        `RED ${Addresses.psAddr + 1}`,
        "ADD 1",
        `WRT ${Addresses.psAddr + 1}`,
        `BIC ${instructionsLength + 66}`,
        `GTO ${instructionsLength + 78}`,
        `RED ${Addresses.psAddr}`,
        "ADD 1",
        `WRT ${Addresses.psAddr}`,
    ]
}

function SETUP(){
    // Setup the runtime environment
    // Start loading values into reserved area
    // Load location of start of stack into StackPointer
    assemblyCode = assemblyCode.concat(
        writeMultiByte(Addresses.StackStart, Addresses.StackPointer, 4)
    );
    
    // Set initial scope to global
    assemblyCode = assemblyCode.concat(
        writeMultiByte(Addresses.GlobalArea, Addresses.ScopePointer, 4)
    );
    // Make sure certain memory addresses are cleared
    assemblyCode = assemblyCode.concat([
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
        [
            // Make sure first 4 bytes of pool contain 0
            "AND 0",
            `WRT ${Addresses.IntFloatPool}`,
            `WRT ${Addresses.IntFloatPool + 1}`,
            `WRT ${Addresses.IntFloatPool + 2}`,
            `WRT ${Addresses.IntFloatPool + 3}`,
        ],
        // Set free pointer to point to first position
        writeMultiByte(Addresses.IntFloatPool, Addresses.PoolFreePointer, 4),
    );
    // Setup heap
    // Location of start of heap can't be known until after instructions compiled as they are placed before the heap in memory
    // First bytes of free block contain info about that block and pointers to next free one
    assemblyCode = assemblyCode.concat([
        // Also write start address of heap into StartChunkPointer and address pseudo-register as we will need to add to it to get pointers
        registerReplacement("InstructionsEndAddress[0]", assemblyCode.length, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapStartPointer}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkPointer}`,
        `WRT ${Addresses.psAddr}`,
        "AND 0",
        registerReplacement("InstructionsEndAddress[1]", assemblyCode.length + 5, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapStartPointer + 1}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkPointer + 1}`,
        `WRT ${Addresses.psAddr + 1}`,
        "AND 0",
        registerReplacement("InstructionsEndAddress[2]", assemblyCode.length + 10, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapStartPointer + 2}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkPointer + 2}`,
        `WRT ${Addresses.psAddr + 2}`,
        "AND 0",
        registerReplacement("InstructionsEndAddress[3]", assemblyCode.length + 15, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapStartPointer + 3}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkPointer + 3}`,
        `WRT ${Addresses.psAddr + 3}`,
        "AND 0",
        // Write heap end address (this could be worked out at runtime, but requires finding a logarithm so it is much more efficient to calculate it at compile time).  Also write to StartChunkEnd
        registerReplacement("HeapEndAddress[0]", assemblyCode.length + 20, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer}`,
        "AND 0",
        registerReplacement("HeapEndAddress[1]", assemblyCode.length + 24, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer + 1}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer + 1}`,
        "AND 0",
        registerReplacement("HeapEndAddress[2]", assemblyCode.length + 28, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer + 2}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer + 2}`,
        "AND 0",
        registerReplacement("HeapEndAddress[3]", assemblyCode.length + 32, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer + 3}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer + 3}`,
        "AND 0",
        // Place size of first block (which will be size of whole heap as nothing has been allocated yet) in first position
        registerReplacement("HeapSizeBase2", assemblyCode.length + 36, "ADD #"),
        `WRT A ${Addresses.psAddr}`,
        "AND 0",
    ]);
    let assCodeLength = calculateInstructionsLength(assemblyCode);
    // Bytes 1-4 (indexing from 0) of free block contain pointer to start of next free block, bytes 5-9 pointer to end of next free block
    // Currently this is the only block, so make sure the pointers contain 0 
    assemblyCode = assemblyCode.concat(
        add32BitIntegers(Addresses.psAddr, 1, assCodeLength, false, true),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        add32BitIntegers(Addresses.psAddr, 1, assCodeLength, false, true),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        add32BitIntegers(Addresses.psAddr, 1, assCodeLength, false, true),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        add32BitIntegers(Addresses.psAddr, 1, assCodeLength, false, true),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assemblyCode = assemblyCode.concat(
        add32BitIntegers(Addresses.psAddr, 1, assCodeLength, false, true),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        add32BitIntegers(Addresses.psAddr, 1, assCodeLength, false, true),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        add32BitIntegers(Addresses.psAddr, 1, assCodeLength, false, true),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        add32BitIntegers(Addresses.psAddr, 1, assCodeLength, false, true),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
}