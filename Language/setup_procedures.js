/*
    The instructions to setup the runtime environment, these are the first instructions run
    The setup procedure is modular to make testing easier:
        - Different parts of the setup process are provided by different functions
        - The main setup function takes a list of these functions as an argument and runs them in order
        - This allows us to exclude certain parts of the setup process, as some may interfere with certain tests (e.g. the global heap allocation tests require the heap to be unused when they run, but this won't be the case if the global variable table and name pool have been setup)
*/

function SETUP(subprocedures){
    let instructs = [];
    for (let i = 0; i < subprocedures.length; i++){
        instructs = subprocedures[i](instructs);
    }
    return instructs;
}

let setup_allSubprocedures = [setupReservedArea, setupIntFloatPool, setupGlobalHeap, setupConstantProcedures, setupGlobalVarTable, setupGlobalNamePool];

function setupReservedArea(instructs){
    /* 
        Load values into reserved area
        Prerequisites: None
    */
    // Load location of start of stack into StackPointer
    instructs = instructs.concat(
        writeMultiByte(Addresses.StackStart, Addresses.StackPointer, 4)
    );
    
    // Set initial scope to global
    instructs = instructs.concat(
        writeMultiByte(Addresses.GlobalArea, Addresses.ScopePointer, 4)
    );
    // Make sure certain memory addresses are cleared
    instructs = instructs.concat([
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
    );
    return instructs;
}

function setupIntFloatPool(instructs){
    /* 
        Setup int / float pool
        Prerequisites: None
    */
    return instructs.concat([
        // Make sure first 4 bytes of pool contain 0
        "AND 0",
        `WRT ${Addresses.IntFloatPool}`,
        `WRT ${Addresses.IntFloatPool + 1}`,
        `WRT ${Addresses.IntFloatPool + 2}`,
        `WRT ${Addresses.IntFloatPool + 3}`,
        ],
        writeMultiByte(Addresses.IntFloatPool, Addresses.PoolFreePointer, 4)
    );
}

function setupGlobalHeap(instructs){
    /* 
        Setup heap
        Prerequisites: None
    */
    // Location of start of heap can't be known until after instructions compiled as they are placed before the heap in memory
    // First bytes of free block contain info about that block and pointers to next free one
    instructs = instructs.concat([
        // Also write start address of heap into StartChunkPointer and address pseudo-register as we will need to add to it to get pointers
        registerReplacement("InstructionsEndAddress[0]", instructs.length, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapStartPointer}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkPointer}`,
        `WRT ${Addresses.psAddr}`,
        "AND 0",
        registerReplacement("InstructionsEndAddress[1]", instructs.length + 5, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapStartPointer + 1}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkPointer + 1}`,
        `WRT ${Addresses.psAddr + 1}`,
        "AND 0",
        registerReplacement("InstructionsEndAddress[2]", instructs.length + 10, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapStartPointer + 2}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkPointer + 2}`,
        `WRT ${Addresses.psAddr + 2}`,
        "AND 0",
        registerReplacement("InstructionsEndAddress[3]", instructs.length + 15, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapStartPointer + 3}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkPointer + 3}`,
        `WRT ${Addresses.psAddr + 3}`,
        "AND 0",
        // Write heap end address (this could be worked out at runtime, but requires finding a logarithm so it is much more efficient to calculate it at compile time)
        registerReplacement("HeapEndAddress[0]", instructs.length + 20, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer}`,
        "AND 0",
        registerReplacement("HeapEndAddress[1]", instructs.length + 23, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer + 1}`,
        "AND 0",
        registerReplacement("HeapEndAddress[2]", instructs.length + 26, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer + 2}`,
        "AND 0",
        registerReplacement("HeapEndAddress[3]", instructs.length + 29, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.HeapEndPointer + 3}`,
        "AND 0",
        // Load address of last byte of heap into StartChunkEndPointer
        registerReplacement("HeapLastAddress[0]", instructs.length + 32, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer}`,
        "AND 0",
        registerReplacement("HeapLastAddress[1]", instructs.length + 35, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer + 1}`,
        "AND 0",
        registerReplacement("HeapLastAddress[2]", instructs.length + 38, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer + 2}`,
        "AND 0",
        registerReplacement("HeapLastAddress[3]", instructs.length + 41, "ADD #"),
        `WRT ${Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer + 3}`,
        "AND 0",
        // Place size of first block (which will be size of whole heap as nothing has been allocated yet) in first position
        registerReplacement("HeapSizeBase2", instructs.length + 44, "ADD #"),
        `WRT A ${Addresses.psAddr}`,
        "AND 0",
    ]);
    let instructsLength = calculateInstructionsLength(instructs);
    // Bytes 1-4 (indexing from 0) of free block contain pointer to start of next free block, bytes 5-9 pointer to end of next free block
    // Currently this is the only block, so make sure the pointers contain 0 
    instructs = instructs.concat(
        incrementAddress(instructsLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    instructsLength = calculateInstructionsLength(instructs);
    instructs = instructs.concat(
        incrementAddress(instructsLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    instructsLength = calculateInstructionsLength(instructs);
    instructs = instructs.concat(
        incrementAddress(instructsLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    instructsLength = calculateInstructionsLength(instructs);
    instructs = instructs.concat(
        incrementAddress(instructsLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    instructsLength = calculateInstructionsLength(instructs);
    instructs = instructs.concat(
        incrementAddress(instructsLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    instructsLength = calculateInstructionsLength(instructs);
    instructs = instructs.concat(
        incrementAddress(instructsLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    instructsLength = calculateInstructionsLength(instructs);
    instructs = instructs.concat(
        incrementAddress(instructsLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    instructsLength = calculateInstructionsLength(instructs);
    instructs = instructs.concat(
        incrementAddress(instructsLength),
        [
            "AND 0",
            `WRT A ${Addresses.psAddr}`
        ]
    );
    return instructs;
}

function setupConstantProcedures(instructs){
    /* 
        Load constant procedures into memory
        Prerequisites: None
    */
    return instructs.concat(AddConstantProcedures(calculateInstructionsLength(instructs)));
}

function setupGlobalVarTable(instructs){
    /*
        Create variable table for global scope
        Prerequisites: setupReservedArea, setupGlobalHeap, setupConstantProcedures
    */
    return instructs.concat(
        VarTable.create(calculateInstructionsLength(instructs), Addresses.NullAddress),
        // The address of the created table is left in ps0, copy to VarTablePointer
        copy(Addresses.ps0, Addresses.GlobalArea + Offsets.frame.VarTablePointer, 4)
    );
}

function setupGlobalNamePool(instructs){
    /*
        Create name pool for global scope
        Prerequisites: setupReservedArea, setupGlobalHeap, setupConstantProcedures
    */
    return instructs.concat(
        NamePool.create(calculateInstructionsLength(instructs)),
        // The address of the created pool is left in ps0, copy to NamePoolPointer
        copy(Addresses.ps0, Addresses.GlobalArea + Offsets.frame.NamePoolPointer, 4)
    );
}