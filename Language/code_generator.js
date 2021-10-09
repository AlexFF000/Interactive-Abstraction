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
var reservedArea = (runtime_options.MemorySize - 1) - (runtime_options.StackSize + runtime_options.EvalStackSize + runtime_options.IntFloatPoolSize + 93)
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
        These MUST be contiguous in memory and consecutive (ps1 must follow ps0, ps2 must follow ps1 etc...) as sometimes data that is more than 4 bytes will be spread across multiple pseudo-registers
    */
    "ps0": reservedArea + 21,
    "ps1": reservedArea + 25,
    "ps2":reservedArea + 29,
    "ps3": reservedArea + 33,
    "ps4": reservedArea + 37,
    "ps5": reservedArea + 41,
    "ps6": reservedArea + 45,
    "ps7": reservedArea + 49,
    "ps8": reservedArea + 53,
    "ps9": reservedArea + 57,
    "ps10": reservedArea + 61,
    "ps11": reservedArea + 65,
    "ps12": reservedArea + 69,
    "ps13": reservedArea + 73,
    "ps14": reservedArea + 77,
    "ps15": reservedArea + 81,
    // Pseudo register specifically for manipulating addresses, useful for pointers
    "psAddr": reservedArea + 85,
    // Pseudo register for holding the address to be jumped to after using one of the constant procedures
    "psReturnAddr": reservedArea + 89,
    // Global area is the "stack frame" for global scope (it isn't really on the stack, but is structured the same as a normal stack frame)
    "GlobalArea": reservedArea + 93,
    // The stack starts immediately after the global area
    "StackStart": reservedArea + 93 + Offsets.frame.EvalStart + runtime_options.EvalStackSize,
    // The buddy allocation system used for the global heap is inefficient for very small objects like ints and floats, so a dedicated pool is used for ints and floats in the global scope
    "IntFloatPool": reservedArea + 93 + Offsets.frame.EvalStart + runtime_options.EvalStackSize + runtime_options.StackSize,
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


function generate_code(intermediates){
    // Get setup code
    let assemblyCode = SETUP();
    // Compile intermediates
    for (let i = 0; i < intermediates.length; i++){
        IntermediateFunctions[intermediates[i][0]](intermediates[i][1]);
    }
    assemblyCode.push("END");  // Add END instruction
    calculateReplacementVariables(assemblyCode);
    performReplacements(assemblyCode, replacements, replacementVariables);
    return assemblyCode;
}

function calculateReplacementVariables(assemblyCode){
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
    // The address after the end of the heap
    let heapEndAddress = instructionsEndAddr + 2 ** heapSizeBase2;
    replacementVariables["HeapEndAddress"] = heapEndAddress;
    replacementVariables["HeapEndAddress[0]"] = getByte(heapEndAddress, 0);
    replacementVariables["HeapEndAddress[1]"] = getByte(heapEndAddress, 1);
    replacementVariables["HeapEndAddress[2]"] = getByte(heapEndAddress, 2);
    replacementVariables["HeapEndAddress[3]"] = getByte(heapEndAddress, 3);
    // The last address in the heap
    let heapLastAddress = heapEndAddress - 1;
    replacementVariables["HeapLastAddress"] = heapLastAddress;
    replacementVariables["HeapLastAddress[0]"] = getByte(heapLastAddress, 0);
    replacementVariables["HeapLastAddress[1]"] = getByte(heapLastAddress, 1);
    replacementVariables["HeapLastAddress[2]"] = getByte(heapLastAddress, 2);
    replacementVariables["HeapLastAddress[3]"] = getByte(heapLastAddress, 3);
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
        // Remove label definition if there is one
        if (currentInstruction[0][0] == "#") currentInstruction.shift();
        if (currentInstruction[0] === "END" || currentInstruction[0] === "NOT" || (currentInstruction[0] === "OUT" && currentInstruction[1] !== "A")){
            // The instruction has no data, so only uses one address
            length += 1;
        }
        else if (["RED", "WRT", "GTO", "BIZ", "BIN", "BIO", "BIC"].includes(currentInstruction[0]) === false && currentInstruction[1] !== "A"){
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
    let instructs = ["AND 0"];
    for (let i = 0; i < addressesNeeded; i++){
        // Add and write, one byte at a time
        let byteValue = getByte(value, 3 - i);
        instructs.push(`ADD ${byteValue}`);
        instructs.push(`WRT ${address + ((addressesNeeded - 1)- i)}`);
        // And with 0 so accumulator is clear ready for next instruction
        instructs.push("AND 0");
    }
    return instructs;
}

function copy(srcAddress, dstAddress, bytes){
    // Return a list of instructions to copy specified number of bytes from source starting at srcAddress to destination starting at dstAddress
    let instructs = ["AND 0"];
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

function copyToAddress(srcAddress, bytes, instructionsLength){
    // Return a list of instructions to copy specified number of bytes from srcAddress to the address in psAddr
    let instructs = [];
    for (let i = 0; i < bytes; i++){
        if (i != 0){
            instructs = instructs.concat(incrementAddress(instructionsLength + calculateInstructionsLength(instructs)));
        }
        instructs.push(`RED ${srcAddress + i}`);
        instructs.push(`WRT A ${Addresses.psAddr}`);
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
        `BIC ${instructionsLength + 110}`,  // Each of these instructions uses 5 bytes, so +100 will give address of first instruction in first byte carry procdure
        // Second byte
        `RED ${int1 + 2}`,
        `ADD A ${int2 + 2}`,
        `WRT ${Addresses.ps3 + 2}`,
        // Carry for this byte must be checked before adding carry from previous, otherwise carry will be wiped
        `BIC ${instructionsLength + 124}`,
        // Add carry for first byte (if there was one)
        `RED ${Addresses.ps3 + 2}`,
        `ADD A ${Addresses.ps2 + 3}`,
        `WRT ${Addresses.ps3 + 2}`,
        // Check if adding the carry caused a carry
        `BIC ${instructionsLength + 138}`,
        // Third byte
        `RED ${int1 + 1}`,
        `ADD A ${int2 + 1}`,
        `WRT ${Addresses.ps3 + 1}`,
        `BIC ${instructionsLength + 152}`,
        `RED ${Addresses.ps3 + 1}`,
        `ADD A ${Addresses.ps2 + 2}`,
        `WRT ${Addresses.ps3 + 1}`,
        // Check if adding the carry caused a carry
        `BIC ${instructionsLength + 166}`,
        // Fourth byte
        `RED ${int1}`,
        `ADD A ${int2}`,
        `ADD A ${Addresses.ps2 + 1}`,
        `WRT ${Addresses.ps3}`,
        // Skip over carry procedures
        `GTO ${instructionsLength + 180}`
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
        // Carry for 2nd byte (after adding carry from previous byte)
        "AND 0",
        "ADD 1",
        `WRT ${Addresses.ps2 + 2}`,
        `GTO ${instructionsLength + 45}`,
        // Carry for third byte
        "AND 0",
        "ADD 1",
        `WRT ${Addresses.ps2 + 1}`,
        `GTO ${instructionsLength + 65}`,
        // Carry for 3rd byte (after adding carry from previous byte)
        "AND 0",
        "ADD 1",
        `WRT ${Addresses.ps2 + 1}`,
        `GTO ${instructionsLength + 85}`
    );
    return instructs;
}

function sub32BitInteger(minuend, subtrahend, instructionsLength, minuendIsLiteral=false, subtrahendIsLiteral=false){
    // Return list of instructions to subtract subtrahend from minuend, leaving the result in ps3
    // Uses ps1 in all cases
    let instructs = [];
    // First flip subtrahend to negative
    if (subtrahendIsLiteral){
        instructs = instructs.concat(writeMultiByte(subtrahend, Addresses.ps1, 4));
    }
    else{
        instructs = instructs.concat(copy(subtrahend, Addresses.ps1, 4));
    }
    instructs = instructs.concat(flip32BitInt2C(Addresses.ps1, instructionsLength + calculateInstructionsLength(instructs)));
    // Now add the flipped subtrahend to minuend
    return instructs.concat(add32BitIntegers(minuend, Addresses.ps1, instructionsLength + calculateInstructionsLength(instructs), minuendIsLiteral, false));
}

function flip32BitInt2C(addressOfInt, instructionsLength){
    // Flip the bits and add 1, (modifies in place)
    let instructs = [
        // Flip the bits
        `RED ${addressOfInt + 3}`,
        "NOT",
        `WRT ${addressOfInt + 3}`,
        `RED ${addressOfInt + 2}`,
        "NOT",
        `WRT ${addressOfInt + 2}`,
        `RED ${addressOfInt + 1}`,
        "NOT",
        `WRT ${addressOfInt + 1}`,
        `RED ${addressOfInt}`,
        "NOT",
        `WRT ${addressOfInt}`,
    ];
    instructionsLength = instructionsLength + calculateInstructionsLength(instructs);
    return instructs.concat(
        [
        // Add 1 to LSB, and only modify the other bytes if there is a carry
        `RED ${addressOfInt + 3}`,
        "ADD 1",
        `WRT ${addressOfInt + 3}`,
        `BIC ${instructionsLength + 22}`,
        `GTO ${instructionsLength + 78}`,
        // There is a carry so also need to add 1 to next byte
        `RED ${addressOfInt + 2}`,
        "ADD 1",
        `WRT ${addressOfInt + 2}`,
        `BIC ${instructionsLength + 44}`,
        `GTO ${instructionsLength + 78}`,
        `RED ${addressOfInt + 1}`,
        "ADD 1",
        `WRT ${addressOfInt + 1}`,
        `BIC ${instructionsLength + 66}`,
        `GTO ${instructionsLength + 78}`,
        `RED ${addressOfInt}`,
        "ADD 1",
        `WRT ${addressOfInt}`
        ]
    );
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

function checkEqual(address1, address2, branchAddressIfEqual, branchAddressIfUnequal, address1IsLiteral=false, address2IsLiteral=false){
    // Return list of instructions to check whether the values at the two addresses (or literals) are equal to one another, and branch to given addresses accordingly
    let instructs = ["AND 0"];
    for (let i = 0; i < 4; i++){
        if (address1IsLiteral){
            instructs.push(`ADD ${getByte(address1, i)}`)
        }
        else{
            instructs.push(`RED ${address1 + i}`);
        }
        if (address2IsLiteral){
            instructs.push(`SUB ${getByte(address2, i)}`);
        }
        else{
            instructs.push(`SUB A ${address2 + i}`);
        }
        // If the bytes are equal, the accumulator will now contain 0.  But we only want to branch if it isn't 0 so add 255 and check for carry (as 0 is the only value that won't carry if 255 is added)
        instructs.push(
            `ADD 255`,
            `BIC ${branchAddressIfUnequal}`,
            "AND 0"
        );
    }
    instructs.push(`GTO ${branchAddressIfEqual}`);
    return instructs;
}

function checkZero(address, bytes, branchAddressIfZero, branchAddressIfNotZero){
    // Return instructions to check if the bytes starting at the given address are all 0 and branch accordingly
    let instructs = ["AND 0"];
    for (let i = 0; i < bytes; i++){
        instructs.push(`BOR A ${address + i}`);
    }
    instructs.push(
        `BIZ ${branchAddressIfZero}`,
        `GTO ${branchAddressIfNotZero}`
    );
    return instructs;
}

function generateByteSequence(inputSeq, length){
    // Generate a sequence of bytes described by the input sequence
    /*
        inputSeq syntax:
        Should be an array, containing an element describing each byte of the output sequence
            - Any byte not described will be set to 0 in the output sequence
        Descriptions should be one of:
            - An integer
                - This integer will be used as the output byte
            - "<"
                - This indicates that the integer from the previous integer byte should take up both that byte and this one
                - e.g. [300, "<"] would mean that 300 is a 2 byte number to be written across two bytes in the output sequence (so the output would be [1, 44])
                - This can also be used across more than two bytes.  e.g. [300, "<", "<", "<"] would write the 300 across four bytes (so output would be [0, 0, 1, 44]).  This only supports up to 4 bytes  
    */
    let outputSeq = [];
    // Use 0's for any bytes without descriptions
    for (let i = 0; i < length - inputSeq.length; i++){
        outputSeq.unshift(0);
    }
    // Generate bytes from descriptions
    let bytesNeeded = 1;
    for (let i = inputSeq.length - 1; 0 <= i; i--){
        if (inputSeq[i] == "<"){
            bytesNeeded++;
        }
        else if (typeof inputSeq[i] == "number"){
            for (let j = 0; j < bytesNeeded; j++){
                outputSeq.unshift((inputSeq[i] >> (j * 8)) & 255)
            }
            bytesNeeded = 1;
        }
        else throw "Invalid input";
    }
    if (outputSeq.length != length) throw "Failed to generate a sequence of given length";
    return outputSeq;
}

function allocateMemory(spaceNeeded, instructionsLength, typeTag=0, forceGlobal=false, copyResult=true, copyResultDst=Addresses.ps0){
    /*
        spaceNeeded should be given as an exponent of 2
        if typeTag is set to a type that can utilise the int/float pool, and the memory is to be allocated globally, the memory will be allocated on the int/float pool (if it has space)
            - typeTag does not need to be provided otherwise
        if forceGlobal is true, the memory will be allocated globally regardless of whether current scope is global
        if copyResult is true, the address of the allocated area will be copied from the eval stack to the 4 addresses starting at copyResultDst
    */
    // Call AllocationProc
    let instructs = EvalStack.pushLiteral(generateByteSequence([spaceNeeded, typeTag, Number(forceGlobal)], 5), instructionsLength);
    instructs = instructs.concat(
        writeMultiByte(instructionsLength + calculateInstructionsLength(instructs.concat(writeMultiByte(5, 5, 4), ["GTO #allocate"])), Addresses.psReturnAddr, 4),
        [
            "GTO #allocate"
        ]
    )
    if (copyResult){
        // Copy result into addresses specified in copyResultDst, and remove layer from eval stack
        instructs = instructs.concat(
            copy(Addresses.EvalTop, Addresses.psAddr, 4)
        )
        instructs = instructs.concat(
            copyFromAddress(copyResultDst, 4, instructionsLength + calculateInstructionsLength(instructs))
        )
        instructs = instructs.concat(
            EvalStack.removeLayer(instructionsLength + calculateInstructionsLength(instructs))
        )
    }
    return instructs;
}

function SETUP(){
    // Setup the runtime environment
    // Start loading values into reserved area
    // Load location of start of stack into StackPointer
    let assemblyCode = [];
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
        // Write heap end address (this could be worked out at runtime, but requires finding a logarithm so it is much more efficient to calculate it at compile time)
        registerReplacement("HeapEndAddress[0]", assemblyCode.length + 20, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer}`,
        "AND 0",
        registerReplacement("HeapEndAddress[1]", assemblyCode.length + 23, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer + 1}`,
        "AND 0",
        registerReplacement("HeapEndAddress[2]", assemblyCode.length + 26, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer + 2}`,
        "AND 0",
        registerReplacement("HeapEndAddress[3]", assemblyCode.length + 29, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer + 3}`,
        "AND 0",
        // Load address of last byte of heap into StartChunkEndPointer
        registerReplacement("HeapLastAddress[0]", assemblyCode.length + 32, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer}`,
        "AND 0",
        registerReplacement("HeapLastAddress[1]", assemblyCode.length + 35, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer + 1}`,
        "AND 0",
        registerReplacement("HeapLastAddress[2]", assemblyCode.length + 38, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer + 2}`,
        "AND 0",
        registerReplacement("HeapLastAddress[3]", assemblyCode.length + 41, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer + 3}`,
        "AND 0",
        // Place size of first block (which will be size of whole heap as nothing has been allocated yet) in first position
        registerReplacement("HeapSizeBase2", assemblyCode.length + 44, "ADD #"),
        `WRT A ${Addresses.psAddr}`,
        "AND 0",
    ]);
    let assCodeLength = calculateInstructionsLength(assemblyCode);
    // Bytes 1-4 (indexing from 0) of free block contain pointer to start of next free block, bytes 5-9 pointer to end of next free block
    // Currently this is the only block, so make sure the pointers contain 0 
    assemblyCode = assemblyCode.concat(
        incrementAddress(assCodeLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        incrementAddress(assCodeLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        incrementAddress(assCodeLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        incrementAddress(assCodeLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        incrementAddress(assCodeLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        incrementAddress(assCodeLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        incrementAddress(assCodeLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(
        incrementAddress(assCodeLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    // Add constant procedures
    assCodeLength = calculateInstructionsLength(assemblyCode);
    assemblyCode = assemblyCode.concat(AddConstantProcedures(assCodeLength));
    // Create global variable table and name pool
    /* assemblyCode = assemblyCode.concat(
        createVariableTable(),
        createNamePool()
    ); */

    return assemblyCode;
}
