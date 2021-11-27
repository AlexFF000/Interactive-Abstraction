/*
    Automated tests for testing runtime constant procedures.
    The tests use functions from the testing.js file.
*/
var tests_constantProcedures = [test_Base2ExponentProc_AllValues];

/* 
    Base2ExponentProc
    Procedure for calculating a 32 bit value for 2^x where x is between 0 and 31
    Should take the exponent as an 8 bit value in ps0[0], and leave the 32 bit result in ps0
    Should return to address in psReturnAddr afterwards
*/
let base2ExponentProcTests_NeededSetup = [setupConstantProcedures];
// Test1 (will simply test whether it puts the correct value in ps0 for each exponent from 0 to 32)
async function test_Base2ExponentProc_AllValues(){
    await runSetup(base2ExponentProcTests_NeededSetup);
    for (let exp = 0; exp < 32; exp++){
        let correctResult = 2 ** exp;
        writeIntToMemory(exp, Addresses.ps0, 1);
        // Write address to jump back to afterwards
        writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(["GTO #base2Exponent"], Addresses.psReturnAddr, 4));
        await runInstructions(["GTO #base2Exponent"], false, true);
        // Check if the result is correct
        let assertionResult = assertMemoryEqualToInt(correctResult, Addresses.ps0, 4);
        if (assertionResult !== true) return `Test Failed with exp = ${exp}: ${assertionResult}`;
    }
    // Test passed for all exponents
    return true;
}

/*
    AllocationProc
    Procedure for allocating memory
*/
var tests_AllocationProc_GlobalPool = [test_AllocationProc_GlobalPoolAllocateWhenEmpty, test_AllocationProc_GlobalPoolAllocateWhenHalfFull, test_AllocationProc_GlobalPoolAllocateWhenFull, test_AllocationProc_GlobalPoolReallocateDeallocated];
var tests_AllocationProc_GlobalHeap = [test_AllocationProc_GlobalHeapAllocateWhenEmpty, test_AllocationProc_GlobalHeapAllocateWhenPartiallyFull, test_AllocationProc_GlobalHeapInsufficientSpace, test_AllocationProc_GlobalHeapReallocateDeallocated, test_AllocationProc_GlobalHeapAllocateLastBlockInChunk, test_AllocationProc_GlobalHeapAllocateFirstBlockInChunk, test_AllocationProc_GlobalHeapAllocateMidBlockInChunk];
var tests_AllocationProc_Local = [test_AllocationProc_FrameHeapAllocateWhenEmpty, test_AllocationProc_FrameHeapInsufficientSpace, test_AllocationProc_FrameHeapReallocateDeallocated, test_AllocationProc_FrameHeapAllocateFromTooLargeChunk, test_AllocationProc_FrameHeapAllocateLastChunkPartial, test_AllocationProc_FrameHeapAllocateLastChunkWhole];
var tests_AllocationProc = tests_AllocationProc_GlobalPool.concat(tests_AllocationProc_GlobalHeap, tests_AllocationProc_Local);
tests_constantProcedures = tests_constantProcedures.concat(tests_AllocationProc);
// The setup subprocedures that need to be run before these tests can work
var allocationProcTests_neededSetup = [setupReservedArea, setupIntFloatPool, setupGlobalHeap, setupConstantProcedures];
// Tests for allocating on the int/float pool

// Test1- Allocating when the pool is empty
async function test_AllocationProc_GlobalPoolAllocateWhenEmpty(){
    // Use Eval stack to request a space on the int/float pool then run the procedure
    /* Then afterwards check that:
        a) The top value on the Eval stack contains the starting address of the pool
        b) The PoolFreePointer points to the 6th byte of the pool
        c) The first four bytes of the next space after the one allocated (i.e. the 6th to 10th bytes of the pool) contain 0 (showing that there is no previously deallocated space)
    */
   // First run the setup procedure, so the runtime environment is setup and the procedures loaded into memory
   await runSetup(allocationProcTests_neededSetup);
   // Add END instruction to jump back to afterwards
    let code = ["GTO #test_afterEndInstruction"];
    let endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
    [
        "END",
        "#test_afterEndInstruction AND 0",
        // Add item to eval stack containing request for space from pool
        // Instead of wasting instructions properly using the eval stack, simply write the details to the first slot in the global eval stack and point EvalTop to it
        "AND 0",
        // Write 32 to 2nd byte to request pool be used
        `ADD 32`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 1}`,
        "AND 0",
        // Make 3rd byte anything other than 0 to request global allocation
        `ADD 1`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
    ],
    // Point EvalTop to the first slot of the global Eval stack
    writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
    // Write return address (the end instruction) to psReturnAddr
    writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
    [
        "GTO #allocate"
    ],
    );
   await runInstructions(code, false);

   // Check a
   let checkResult = assertMemoryEqualToInt(Addresses.IntFloatPool, Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
   if (checkResult !== true) return checkResult;
   // Check b
   checkResult = assertMemoryEqualToInt(Addresses.IntFloatPool + 5, Addresses.PoolFreePointer, 4);
   if (checkResult !== true) return checkResult;
   // Check c
   return assertMemoryEqualToInt(0, Addresses.IntFloatPool + 5, 4);
}
// Test2- Allocating when pool is not empty, but not full
async function test_AllocationProc_GlobalPoolAllocateWhenHalfFull(){
    // Fill half of the free spaces in the pool, incrementing the PoolFreePointer accordingly
    // Then use Eval stack to request a space and run the procedure
    /* Then afterwards check that:
        a) The top value on the Eval stack contains the starting address of the first block after those that have been filled
        b) The PoolFreePointer points to the starting address of the next space
        c) The first four bytes of the next space after the one allocated contain 0
    */
   // Run setup first as it will overwrite PoolFreePointer
   await runSetup(allocationProcTests_neededSetup);
   let poolMidSlot = Addresses.IntFloatPool + ((runtime_options.IntFloatPoolSize - 5) / 2);
   writeIntToMemory(poolMidSlot, Addresses.PoolFreePointer, 4);
   // Add END instruction to jump back ot afterwards
    let code = ["GTO #test_afterEndInstruction"];
    let endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
    [
        "END",
        "#test_afterEndInstruction AND 0",
        // Add item to eval stack containing request for space from pool
        // Instead of wasting instructions properly using the eval stack, simply write the details to the first slot in the global eval stack and point EvalTop to it
        "AND 0",
        // Write 32 to 2nd byte to request pool be used
        `ADD 32`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 1}`,
        "AND 0",
        // Make 3rd byte anything other than 0 to request global allocation
        `ADD 1`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
    ],
    // Point EvalTop to the first slot of the global Eval stack
    writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
    // Write return address (the end instruction) to psReturnAddr
    writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
    [
        "GTO #allocate"
    ]
    );
   await runInstructions(code, false);

   // check a
   let checkResult = assertMemoryEqualToInt(poolMidSlot, Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
   if (checkResult !== true) return checkResult;
   // check b
   checkResult = assertMemoryEqualToInt(poolMidSlot + 5, Addresses.PoolFreePointer, 4);
   if (checkResult !== true) return checkResult;
   // check c
   return assertMemoryEqualToInt(0, poolMidSlot + 5, 4);
}
// Test3- Trying to allocate when pool is full (it should allocate from the heap instead, and the pool should not be modified)
async function test_AllocationProc_GlobalPoolAllocateWhenFull(){
    // Fill all of the free spaces in the pool, incrementing PoolFreePointer accordingly
    // Then use Eval stack to request a space and run the procedure
    /* Then afterwards check that:
        a) The top value on the Eval stack contains an address, but not one from inside the pool
        b) The PoolFreePointer has not been changed
    */
   await runSetup(allocationProcTests_neededSetup);
   writeIntToMemory(Addresses.IntFloatPool + runtime_options.IntFloatPoolSize, Addresses.PoolFreePointer, 4);
   // Add END instruction to jump back to afterwards
    let code = ["GTO #test_afterEndInstruction"];
    let endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
    [
        "END",
        "#test_afterEndInstruction AND 0",
        // Add item to eval stack containing request for space from pool
        // Instead of wasting instructions properly using the eval stack, simply write the details to the first slot in the global eval stack and point EvalTop to it
        "AND 0",
        // Write 32 to 2nd byte to request pool be used
        `ADD 32`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 1}`,
        "AND 0",
        // Make 3rd byte anything other than 0 to request global allocation
        `ADD 1`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
    ],
    // Point EvalTop to the first slot of the global Eval stack
    writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
    // Write return address (the end instruction) to psReturnAddr
    writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
    [
        "GTO #allocate"
    ],
    );
   await runInstructions(code, false);
   
   // Check a
   let allocatedAddress = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
   if (Addresses.IntFloatPool <= allocatedAddress && allocatedAddress < Addresses.IntFloatPool + runtime_options.IntFloatPoolSize) return `Test failed on check A: Allocated address (${allocatedAddress}) is in the pool`;
   // Check b
   return assertMemoryEqualToInt(Addresses.IntFloatPool + runtime_options.IntFloatPoolSize, Addresses.PoolFreePointer, 4);
}
// Test4- Reallocating previously deallocated space
async function test_AllocationProc_GlobalPoolReallocateDeallocated(){ return "NOT IMPLEMENTED";
    // Fill half of the free spaces in the pool, then deallocate one of these spaces (but not one at the start or end)
    // Then use Eval stack to request a space and run the procedure
    /*
        Then afterwards check that:
            a) The top value on the Eval stack contains the starting address of the deallocated space
            b) The PoolFreePointer points to the first space after the halfway point (a new space should not have been allocated)
    */
    await runSetup();
    let poolMidSlot = Addresses.IntFloatPool + ((runtime_options.IntFloatPoolSize - 5) / 2);
    // Use the 10th space as the free one (the choice of 10th is arbitrary)
    let freeSlot = Addresses.IntFloatPool + (5 * 10);
    writeIntToMemory(poolMidSlot, freeSlot, 4);
    writeIntToMemory(freeSlot, Addresses.PoolFreePointer, 4);
    // Add END instruction to jump back to afterwards
    let code = ["GTO #test_afterEndInstruction"];
    let endInstructionAddr = calculateInstructionsLength(code);
    code = code.concat(
    [
        "END",
        "#test_afterEndInstruction AND 0",
        // Add item to eval stack containing request for space from pool
        // Instead of wasting instructions properly using the eval stack, simply write the details to the first slot in the global eval stack and point EvalTop to it
        "AND 0",
        // Write 32 to 2nd byte to request pool be used
        `ADD 32`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 1}`,
        "AND 0",
        // Make 3rd byte anything other than 0 to request global allocation
        `ADD 1`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
    ],
    // Point EvalTop to the first slot of the global Eval stack
    writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
    // Write return address (the end instruction) to psReturnAddr
    writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
    [
        "GTO #allocate"
    ],
    );
   await runInstructions(code, false);

   // Check a
   let checkResult = assertMemoryEqualToInt(freeSlot, Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
   if (checkResult !== true) return checkResult;
   // Check b
   return assertMemoryEqualToInt(poolMidSlot, Addresses.PoolFreePointer, 4);
}

// Tests for allocation on global heap

// Test5- Allocating when heap is empty
async function test_AllocationProc_GlobalHeapAllocateWhenEmpty(){
    // Request the smallest allowed space on the heap (32 bytes) and run the procedure
    /*
        Then afterwards check that:
            a) The top value on the eval stack is the starting address of the heap (meaning the correct bytes, the first 32, have been allocated)
            b) The chunkStart pointer points to the 33rd byte of the heap, and the chunkEnd pointer points to the last byte in the heap (meaning the free chunk contains the entire heap but the allocated 32 bytes)
            c) The 2nd - 5th bytes of the free chunk contain 0 (meaning there is no next free chunk)
            d)  Starting from 0, heap[32] contains "5", heap[64] and heap[128] contain "6", heap[192] and heap[320] contain "7", this pattern continues and ends with the first byte in the second half of the heap, which contains x-1 where x is the size of the heap as an exponent of 2
    */
   await runSetup(allocationProcTests_neededSetup);
   let code = ["GTO #test_afterEndInstruction"];
   let endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
   code = code.concat(
       [
           "END",
           "#test_afterEndInstruction AND 0",
           "ADD 5",
           `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
           // Make 3rd byte anything other than 0 to request global allocation
           `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`,
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
   );
   await runInstructions(code, false);
   // Heap starts after the last instruction
   let startOfHeap = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
   // Check a
   let checkResult = assertMemoryEqualToInt(startOfHeap, Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
   if (checkResult !== true) return checkResult;
   // Check b
   checkResult = assertMemoryEqualToInt(startOfHeap + 32, Addresses.GlobalArea + Offsets.frame.StartChunkPointer, 4);
   if (checkResult !== true) return checkResult;
   checkResult = assertMemoryEqualToInt(readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapEndPointer, 4), Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer);
   if (checkResult !== true) return checkResult;
   // Check c
   checkResult = assertMemoryEqualToInt(0, readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.StartChunkPointer, 4) + 1, 4);
   if (checkResult !== true) return checkResult;
   // Check d
   let firstByteAfterMidpoint = Math.floor((readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapEndPointer, 4) - readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4)) / 2) + 1;
   let currentBlockPos = 32;
   let expectedExp = 5;
   while (currentBlockPos <= firstByteAfterMidpoint){
       checkResult = assertMemoryEqualToInt(expectedExp, startOfHeap + currentBlockPos, 1);
       if (checkResult !== true) return `Test failed on check D with currentBlockPos = ${currentBlockPos} and expectedExp = ${expectedExp}: ${checkResult}`;
        expectedExp++;
        currentBlockPos *= 2;
   }
   return true;
}
// Test 6- Allocating when heap is partially full
async function test_AllocationProc_GlobalHeapAllocateWhenPartiallyFull(){
    // Request 4096 bytes after already allocating 64 bytes
    /*
        Then afterwards check that:
            a) The top value on the eval stack is heap[4096]
            b) The chunkStart pointer points to heap[64], and the chunkEnd pointer points to heap[4095]
            c) The first free chunk's next start pointer at heap[65-68] points to heap[8192], and heap[69-72] points to the last byte of the heap (as there should now be two free chunks, separated by the 4096 bytes just allocated)
            d) The second free chunk's next start pointer at heap[8193-8196] contains 0 (as there are no more free chunks)
    */
   await runSetup(allocationProcTests_neededSetup);
   let startOfHeap = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
   // writeIntToMemory(startOfHeap + 64, Addresses.GlobalArea + Offsets.frame.StartChunkPointer, 4);
   // Allocate 64 bytes
   let code = ["GTO #test_afterEndInstruction"];
   let endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
   code = code.concat(
       [ 
       "END",
       "#test_afterEndInstruction AND 0",
       "ADD 6",
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
   );
   await runInstructions(code, false);
   code = ["GTO #test_afterEndInstruction"];
   endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
   code = code.concat(
       [
           "END",
           "#test_afterEndInstruction AND 0",
           // 2^12 = 4096
           "ADD 12",
           `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
           // Make 3rd byte anything other than 0 to request global allocation
           `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`,
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
   );
   await runInstructions(code, false);

   // Check a
   let checkResult = assertMemoryEqualToInt(startOfHeap + 4096, Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
   if (checkResult !== true) return checkResult;
   // Check b
   checkResult = assertMemoryEqualToInt(startOfHeap + 64, Addresses.GlobalArea + Offsets.frame.StartChunkPointer, 4);
   if (checkResult !== true) return checkResult;
   checkResult = assertMemoryEqualToInt(startOfHeap + 4095, Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer, 4);
   if (checkResult !== true) return checkResult;
   // Check c
   checkResult = assertMemoryEqualToInt(startOfHeap + 8192, startOfHeap + 65, 4);
   if (checkResult !== true) return checkResult;
   checkResult = assertMemoryEqualToInt(readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapEndPointer, 4) - 1, startOfHeap + 69, 4);
   if (checkResult !== true) return checkResult;
   // Check d
   return assertMemoryEqualToInt(0, startOfHeap + 8193, 4);
}
// Test7- Allocating when heap has no large enough blocks
async function test_AllocationProc_GlobalHeapInsufficientSpace(){ return "NOT IMPLEMENTED";
    // Allocate a 32 byte block, followed by three 2^(x-2) byte blocks (where x is the heap size as an exponent of 2)
    // Then request another 2^(x-2) bytes.  This should cause a NOT ENOUGH SPACE error
}
// Test8- Allocating from deallocated space  TODO: UPDATE THIS WHEN DEALLOC PROCEDURE IS WRITTEN
async function test_AllocationProc_GlobalHeapReallocateDeallocated(){ return "NOT IMPLEMENTED";
    // Allocate a 32 byte block, followed by three 2^(x-2) byte blocks (where x is the heap size as an exponent of 2)
    // Then deallocate the block starting at the halfway point of the heap
    // Then request another 2^(x-2) block
    // Then check that the top value on the eval stack is the address of the first byte after the midpoint of the heap (meaning the deallocated space was reallocated)
    await runSetup();
    let heapSizeBase2 = Math.log2(readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapEndPointer, 4) - readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4));
    writeIntToMemory(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4);
    let code = [
        "ADD 5",
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
    ];
    code = code.concat(
        // Write address to jump back to after allocation into psReturnAddr
        writeMultiByte(calculateInstructionsLength(code.concat(writeMultiByte(0, 0, 4), ["GTO #allocate"])), Addresses.psReturnAddr, 4),
        [
            "GTO #allocate",
            "AND 0",
            `ADD ${heapSizeBase2 - 2}`,
            `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
            `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
        ]
    );
    code = code.concat(
        writeMultiByte(calculateInstructionsLength(code.concat(writeMultiByte(0, 0, 4), ["GTO #allocate"])), Addresses.psReturnAddr, 4),
        [
            "GTO #allocate",
            "AND 0",
            `ADD ${heapSizeBase2 - 2}`,
            `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
            `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
        ]
    );
    code = code.concat(
        writeMultiByte(calculateInstructionsLength(code.concat(writeMultiByte(0, 0, 4), ["GTO #allocate"])), Addresses.psReturnAddr, 4),
        [
            "GTO #allocate",
            "AND 0",
            `ADD ${heapSizeBase2 - 2}`,
            `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
            `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
        ]
    );
    code = code.concat(
        writeMultiByte(calculateInstructionsLength(code.concat(writeMultiByte(0, 0, 4), ["GTO #allocate"])), Addresses.psReturnAddr, 4),
        [
            "GTO #allocate",
            "END",
        ],
    );
    runInstructions(code, false);
    // Deallocate the block at the halfway point
    let firstByteAfterMidpoint = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4) + Math.floor((readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapEndPointer, 4) - readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4)) / 2) + 1;
    writeIntToMemory(readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.StartChunkPointer, 4), firstByteAfterMidpoint + 1, 4);
    writeIntToMemory(readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer, 4), firstByteAfterMidpoint + 5, 4);
    writeIntToMemory(firstByteAfterMidpoint, Addresses.GlobalArea + Offsets.frame.StartChunkPointer, 4);
    writeIntToMemory(firstByteAfterMidpoint + (2 ** (heapSizeBase2 - 2) - 1), Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer, 4);
    writeIntToMemory(heapSizeBase2 - 2, firstByteAfterMidpoint, 1);
    
    code = [
        "AND 0",
        `ADD ${heapSizeBase2 - 2}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
        `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
    ];
    code = code.concat(
        writeMultiByte(calculateInstructionsLength(code.concat(writeMultiByte(0, 0, 4), ["GTO #allocate"])), Addresses.psReturnAddr, 4),
        "GTO #allocate",
        "END"
    );
    runInstructions(code, false);
    return assertMemoryEqualToInt(firstByteAfterMidpoint, Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
}
// Test9- Allocating last block in chunk
async function test_AllocationProc_GlobalHeapAllocateLastBlockInChunk(){
    // Allocate a 32 byte (2 ^ 5) block, followed by a 2^(x-1) block (where x is the heap size as an exponent of 2), therefore leaving a large free chunk between the allocated blocks
    // Then allocate a 2^(x-2) block, as this will allocate the last block in the chunk.
    // Then check that the pointer to the end of the chunk points to the new end of the chunk (the byte before the start of the allocated block)
    await runSetup(allocationProcTests_neededSetup);
    let heapSizeBase2 = Math.log2(readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapEndPointer, 4) - readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4));
    // Allocate 32 bytes
    let code = ["GTO #test_afterEndInstruction"];
    let endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
       [ 
       "END",
       "#test_afterEndInstruction AND 0",
       "ADD 5",
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
    );
    await runInstructions(code, false);
    // Allocate 2^(x-1) bytes
    code = ["GTO #test_afterEndInstruction"];
    endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
       [ 
       "END",
       "#test_afterEndInstruction AND 0",
       `ADD ${heapSizeBase2 - 1}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
    );
    await runInstructions(code, false);
    // Allocate 2^(x-2) bytes
    code = ["GTO #test_afterEndInstruction"];
    endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
       [ 
       "END",
       "#test_afterEndInstruction AND 0",
       `ADD ${heapSizeBase2 - 2}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
    );
    await runInstructions(code, false);
    // Calculate the correct end address of the first chunk (should be the byte before the 2^(x-2) block before the midpoint)
    let expectedChunkEnd = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4) + (((2 ** (heapSizeBase2 - 1)) - 1) - (2 ** (heapSizeBase2 - 2)))
    return assertMemoryEqualToInt(expectedChunkEnd, Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer, 4);
}
// Test10- Allocating first block in chunk
async function test_AllocationProc_GlobalHeapAllocateFirstBlockInChunk(){
    // Allocate a 32 (2^5) byte block, followed by a 2^(x-2) block (where x is the size of the heap as an exponent of 2).  This will leave a large free chunk between the two allocated blocks, and another free chunk starting at the midpoint of the heap
    // Although the second free chunk is not used, it must exist to be able to check if the pointers are correct (as otherwise the pointers would contain 0, the same value as unwritten memory addresses)
    // Then allocate another 32 byte block, thus allocating the first block in the chunk
    /*
        Then afterwards check that:
            a) StartChunkPointer points to heapAddress + 64 (the new start of the chunk)
            b) heap[65-68] points to the heap midpoint (meaning the next chunk start pointer was correctly moved)
            c) heap[69-72] points to the last byte in the heap (meaning the next chunk end pointer was moved correctly)
    */
    await runSetup(allocationProcTests_neededSetup);
    let heapSizeBase2 = Math.log2(readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapEndPointer, 4) - readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4));
    // Allocate 32 bytes
    let code = ["GTO #test_afterEndInstruction"];
    let endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
       [ 
       "END",
       "#test_afterEndInstruction AND 0",
       "ADD 5",
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
    );
    await runInstructions(code, false);
    // Allocate 2^(x-2) bytes
    code = ["GTO #test_afterEndInstruction"];
    endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
       [ 
       "END",
       "#test_afterEndInstruction AND 0",
       `ADD ${heapSizeBase2 - 2}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
    );
    await runInstructions(code, false);
    // Allocate another 32 byte block
    code = ["GTO #test_afterEndInstruction"];
    endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
       [ 
       "END",
       "#test_afterEndInstruction AND 0",
       "ADD 5",
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
    );
    await runInstructions(code, false);
    let heapMidpoint = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4) + Math.floor((readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapEndPointer, 4) - readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4)) / 2);
    let startOfHeap = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
    let lastByteOfHeap = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapEndPointer, 4) - 1;
    // Check a
    let checkResult = assertMemoryEqualToInt(startOfHeap + 64, Addresses.GlobalArea + Offsets.frame.StartChunkPointer, 4);
    if (checkResult !== true) return checkResult;
    // Check b
    checkResult = assertMemoryEqualToInt(heapMidpoint, startOfHeap + 65, 4);
    if (checkResult !== true) return checkResult;
    // Check c
    return assertMemoryEqualToInt(lastByteOfHeap, startOfHeap + 69, 4);
}
// Test11- Allocating block in middle of chunk
async function test_AllocationProc_GlobalHeapAllocateMidBlockInChunk(){
    // Allocate a 32 (2^5) byte block, followed by a 2^(x-2) block (where x is the size of the heap as an exponent of 2).  This will leave 2 free chunks, one starting at heap[32] and the other at the midpoint
    // Although the second free chunk is not used, it must exist to be able to check if the pointers are correct (as otherwise the pointers would contain 0, the same value as unwritten memory addresses)
    // Then allocate a 128 (2^7) byte block (this size is arbitrary, we could allocate any block in the first free chunk as long as it isn't the first or last (i.e. any size between 2^6 and 2^(x-3) would be suitable))
    /*
        Then afterwards check that:
            a) The next chunk start pointer (at heap[33-36]) in the first chunk points to heap[256] (meaning the first chunk's next chunk start pointer has been correctly updated)
            b) The next chunk end pointer (at heap[37-40]) in the first chunk contains the original end pointer for the first chunk (i.e. the end point of the first chunk before the 2^7 block was allocated) (this means the first chunk's next chunk end pointer has been correctly updated)
            c) The pointers starting at heap[257] are the same as the next chunk pointers from the original first chunk (i.e. the next chunk start and end pointers from the first chunk, before the 2^7 block was allocated) (this means the new chunk has correctly been given the pointers to the next chunk)
    */
   await runSetup(allocationProcTests_neededSetup);
   let heapSizeBase2 = Math.log2(readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapEndPointer, 4) - readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4));
   // Allocate 32 byte block
    let code = ["GTO #test_afterEndInstruction"];
    let endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
       [ 
       "END",
       "#test_afterEndInstruction AND 0",
       "ADD 5",
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
    );
    await runInstructions(code, false);
    // Allocate 2^(x-2) bytes
    code = ["GTO #test_afterEndInstruction"];
    endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
       [ 
       "END",
       "#test_afterEndInstruction AND 0",
       `ADD ${heapSizeBase2 - 2}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
    );
    await runInstructions(code, false);
    // Record the pointers for and from the first chunk
    let originalFirstChunkEnd = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer, 4);
    let originalFirstChunkStart = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.StartChunkPointer, 4);
    let orignalFirstChunkNextChunkStartPointer = readMemoryAsInt(originalFirstChunkStart + 1, 4);
    let originalFirstChunkNextChunkEndPointer = readMemoryAsInt(originalFirstChunkStart + 5, 4);
    // Allocate 2^7 byte block
    code = ["GTO #test_afterEndInstruction"];
    endInstructionAddr = testsInstructionsStart + calculateInstructionsLength(code);
    code = code.concat(
       [ 
       "END",
       "#test_afterEndInstruction AND 0",
       `ADD 7`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart}`,
       `WRT ${Addresses.GlobalArea + Offsets.frame.EvalStart + 2}`
       ],
       writeMultiByte(Addresses.GlobalArea + Offsets.frame.EvalStart, Addresses.EvalTop, 4),
       writeMultiByte(endInstructionAddr, Addresses.psReturnAddr, 4),
       ["GTO #allocate"]
    );
    await runInstructions(code, false);
    let startOfHeap = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
    // Check a
    let checkResult = assertMemoryEqualToInt(startOfHeap + 256, startOfHeap + 33, 4);
    if (checkResult !== true) return checkResult;
    // Check b
    checkResult = assertMemoryEqualToInt(originalFirstChunkEnd, startOfHeap + 37, 4);
    if (checkResult !== true) return checkResult;
    // Check c
    // I
    checkResult = assertMemoryEqualToInt(orignalFirstChunkNextChunkStartPointer, startOfHeap + 257, 4);
    if (checkResult !== true) return checkResult;
    // II
    return assertMemoryEqualToInt(originalFirstChunkNextChunkEndPointer, startOfHeap + 261, 4);
}
// Tests for allocation within stack frame

// Test12- Allocating when frame heap is empty
async function test_AllocationProc_FrameHeapAllocateWhenEmpty(){ return "NOT IMPLEMENTED";
    // Request the smallest allowed space (32 bytes) and run the procedure
    /*
        Then afterwards check that:
            a) The top value on the eval stack is the first byte of the frame heap
            b) firstChunkStart points to frame heap start + 32
            c) The first four bytes of the free chunk contain the number of bytes between the end of the newly allocated space, and the end of the stack
            d) The following eight bytes all contain 0, as there should be no following free chunk
    */
}
// Test13- Allocating when there is not enough space left on stack
async function test_AllocationProc_FrameHeapInsufficientSpace(){ return "NOT IMPLEMENTED";
    // Request an amount of space larger than what is left on the stack and run the procedure
    // This should throw a NOT ENOUGH SPACE error
}
// Test14- Allocating from deallocated space
async function test_AllocationProc_FrameHeapReallocateDeallocated(){ return "NOT IMPLEMENTED";
    // Allocate 256 bytes on the heap
    // Then deallocate 64 bytes at frame heap start + 128
    // Then request 32 bytes and run the procedure
    /*
        Then check that:
            a) The top value on the eval stack is frame heap start + 128
            b) firstChunkStart points to frame heap start + 160, and firstChunkEnd points to frame heap start + 192
            c) The 5th-8th bytes (next chunk start pointer) of the first chunk point to frame heap start + 256
    */
}
// Test15- Allocating from a chunk that is too large (but which is not the first chunk)
async function test_AllocationProc_FrameHeapAllocateFromTooLargeChunk(){ return "NOT IMPLEMENTED";
    
}
// Test16- Allocating part of the last chunk
async function test_AllocationProc_FrameHeapAllocateLastChunkPartial(){ return "NOT IMPLEMENTED";
    // Make sure StackPointer and LastChunkStartPointer now point to the new start of the chunk, as well as the previous chunk's pointers.  Also make sure the size field in the new chunk is correct
}
// Test17- Allocating the whole last chunk
async function test_AllocationProc_FrameHeapAllocateLastChunkWhole(){ return "NOT IMPLEMENTED";
    // Make sure the previous chunk's pointer to the start of next chunk contains 0, and StackPointer and lastChunkStartPointer point to the address after the end of the stack
}

/*
    IntMultProc
    Procedure for multiplying two 32 bit signed ints
*/
var intMultProcTests_neededSetup = [setupConstantProcedures]
var tests_IntMultProc = [test_IntMultProc_ZeroByZero, test_IntMultProc_ZeroByOne, test_IntMultProc_OneByOne, test_IntMultProc_Commutative, test_IntMultProc_NBytesByNBytes, test_IntMultProc_4BytesBy1Byte, test_IntMultProc_NegByPos, test_IntMultProc_NegByNeg, test_IntMultProc_NegByZero, test_IntMultProc_OverflowDuringShift, test_IntMultProc_OverflowIntoSignBitDuringShift, test_IntMultProc_OverflowDuringAdd];
tests_constantProcedures = tests_constantProcedures.concat(tests_IntMultProc);

// Test1- 0 x 0
async function test_IntMultProc_ZeroByZero(){
    // Multiply 0 by 0, and then check that result is 0
    await runSetup(intMultProcTests_neededSetup);
    // Set ps10 to contain something other than 0 to make sure it was not already 0
    writeIntToMemory((2 ** 32)- 1, Addresses.ps10, 4);
    writeIntToMemory(0, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(0, Addresses.ps9, 4);  // Write multiplier
    let code = ["GTO #intMult"]
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    return assertMemoryEqualToInt(0, Addresses.ps10, 4);
}
// Test2- 0 x 1
async function test_IntMultProc_ZeroByOne(){
    // Multiply 0 by 1, and then check that the result is 0
    await runSetup(intMultProcTests_neededSetup);
    // Set ps10 to contain something other than 0 to make sure it was not already 0
    writeIntToMemory((2 ** 32)- 1, Addresses.ps10, 4);
    writeIntToMemory(0, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(1, Addresses.ps9, 4);  // Write multiplier
    let code = ["GTO #intMult"]
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    return assertMemoryEqualToInt(0, Addresses.ps10, 4);
}
// Test3 1 x 1
async function test_IntMultProc_OneByOne(){
    // Multiply 1 by 1, and then check that the result is 1
    await runSetup(intMultProcTests_neededSetup);
    writeIntToMemory(1, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(1, Addresses.ps9, 4);  // Write multiplier
    let code = ["GTO #intMult"]
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    return assertMemoryEqualToInt(1, Addresses.ps10, 4);
}
// Test4- Commutative
async function test_IntMultProc_Commutative(){
    // Multiply 301256 by 461, and check the result is 138879016
    // Then multiply 461 by 301256, and check the result is also 138879016
    await runSetup(intMultProcTests_neededSetup);
    writeIntToMemory(301256, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(461, Addresses.ps9, 4);  // Write multiplier
    let code = ["GTO #intMult"]
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    let checkResult = assertMemoryEqualToInt(138879016, Addresses.ps10, 4);
    if (checkResult !== true) return checkResult;
    // Clear output to make sure it has actually been recalculated
    writeIntToMemory(0, Addresses.ps10, 4);
    writeIntToMemory(461, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(301256, Addresses.ps9, 4);  // Write multiplier
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    return assertMemoryEqualToInt(138879016, Addresses.ps10, 4);
}
// Test5- 1 byte * 1 byte, 2 byte * 2 byte with carrying (i.e. result should use more bytes than the operands, e.g. the result of the 1 byte * 1 byte should use 2 bytes)
async function test_IntMultProc_NBytesByNBytes(){
    /*
        We can't multiply two 3 byte numbers without overflowing beyond 32 bits, so only try this with 1 and 2 byte numbers
        a) Multiply 126 by 81 and check result is 10206
        b) Multiply 21936 by 287 and check result is 6295632
    */
    await runSetup(intMultProcTests_neededSetup);
    // a
    writeIntToMemory(126, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(81, Addresses.ps9, 4);  // Write multiplier
    let code = ["GTO #intMult"]
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    let checkResult = assertMemoryEqualToInt(10206, Addresses.ps10, 4);
    if (checkResult !== true) return checkResult;
    // b
    writeIntToMemory(21936, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(287, Addresses.ps9, 4);  // Write multiplier
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    return assertMemoryEqualToInt(6295632, Addresses.ps10, 4);
}
// Test6- 4 byte * 1 byte
async function test_IntMultProc_4BytesBy1Byte(){
    // Multiply 125 by 16777217 and check result is 2097152125
    await runSetup(intMultProcTests_neededSetup);
    writeIntToMemory(125, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(16777217, Addresses.ps9, 4);  // Write multiplier
    let code = ["GTO #intMult"]
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    return assertMemoryEqualToInt(2097152125, Addresses.ps10, 4);
}
// Test7- Neg * Pos
async function test_IntMultProc_NegByPos(){
    // Multiply -16777217 by 11 and check result is -184549387
    await runSetup(intMultProcTests_neededSetup);
    writeIntToMemory(-16777217, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(11, Addresses.ps9, 4);  // Write multiplier
    let code = ["GTO #intMult"]
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    return assertMemoryEqualToInt(-184549387, Addresses.ps10, 4);
}
// Test8- Neg * Neg
async function test_IntMultProc_NegByNeg(){
    // Multiply -16777217 by -11 and check result is 184549387
    await runSetup(intMultProcTests_neededSetup);
    writeIntToMemory(-16777217, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(-11, Addresses.ps9, 4);  // Write multiplier
    let code = ["GTO #intMult"]
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    return assertMemoryEqualToInt(184549387, Addresses.ps10, 4);
}
// Test9- Neg * 0
async function test_IntMultProc_NegByZero(){
    // Multiply -16777217 by 0 and check result is 0
    await runSetup(intMultProcTests_neededSetup);
    writeIntToMemory(-16777217, Addresses.ps8, 4);  // Write multiplicand
    writeIntToMemory(0, Addresses.ps9, 4);  // Write multiplier
    writeIntToMemory((2 ** 32) - 1, Addresses.ps10, 4);  // Make sure result doesn't already contain 0, otherwise the test will pass if the result is not loaded into ps10
    let code = ["GTO #intMult"]
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(code), Addresses.psReturnAddr, 4);
    await runInstructions(code, false, true);
    return assertMemoryEqualToInt(0, Addresses.ps10, 4);
}
// Test10- Overflow during shifting
async function test_IntMultProc_OverflowDuringShift(){
    /* 
        Multiply 1073741824 by 4 and check that overflow error has been raised
        1,073,741,824 has been chosen as left shifting it by 2 (which multiplying by 4 will do) will shift the 1 beyond 32 bits.  The procedure should detect this at the point of doing the shift and should throw error
    */
   return "NOT IMPLEMENTED";
}
// Test11- Overflow into sign bit during shifting
async function test_IntMultProc_OverflowIntoSignBitDuringShift(){
    /*
        Multiply 1073741824 by 2 and check that overflow error has been raised
        1,073,741,824 has been chosen as left shifting by 1 (which multiplying by 2 will do) will shift into the sign bit
        This should cause an overflow error
    */
   return "NOT IMPLEMENTED";
}
// Test12- Overflow during addition
async function test_IntMultProc_OverflowDuringAdd(){
    /*
        Multiply 1073741823 by 3 and check that overflow error has been raised
        These operands have been chosen as multiplying by 3 will mean left shifting by 1 and 0 places
        Although neither of these shifts will overflow alone, when we try to add them to the result it will overflow into the sign bit.
    */
   return "NOT IMPLEMENTED";
}

/*
    AllocateNameProc
    Procedure for allocating space from a name pool
    Should take inputs on EvalStack:
        EvalTop[0] = Number of 5 byte "blocks" needed for the name
        EvalTop[1] = Set to non-zero to allocate the name from the global name pool, otherwise current scope's one will be used
    Should leave output on EvalStack:
        EvalTop[0:3] = Address of the allocated space
*/
let tests_AllocateNameProc = [test_AllocateNameProc_GlobalPoolAllocateWhenEmptyNoExpansions, test_AllocateNameProc_LocalPoolAllocateWhenEmptyNoExpansions, test_AllocateNameProc_GlobalPoolAllocateWhenPartiallyFullNoExpansions, test_AllocateNameProc_LocalPoolAllocateWhenPartiallyFullNoExpansions, test_AllocateNameProc_GlobalAllocateWhenFullNoExpansions, test_AllocateNameProc_LocalAllocateWhenFullNoExpansions, test_AllocateNameProc_GlobalPoolAllocateWhenParentFullAnd1PartiallyFullExpansion, test_AllocateNameProc_LocalPoolAllocateWhenParentFullAnd1PartiallyFullExpansion, test_AllocateNameProc_AllocateTooLargeSpace, test_AllocateNameProc_GlobalPoolAllocateWhenCompletelyFullAndMaxExpansionsReached, test_AllocateNameProc_LocalPoolAllocateWhenCompletelyFullAndMaxExpansionsReached, test_AllocateNameProc_GlobalPoolAllocateDeallocated, test_AllocateNameProc_LocalPoolAllocateDeallocated];
tests_constantProcedures = tests_constantProcedures.concat(tests_AllocateNameProc);
let allocateNameProcTests_neededSetup = [setupReservedArea, setupGlobalHeap, setupConstantProcedures, setupGlobalNamePool];

// Test1- Allocating from global parent pool when there are no expansions and pool is empty
async function test_AllocateNameProc_GlobalPoolAllocateWhenEmptyNoExpansions(){
    /*
        Use EvalStack to request a 27 block space on the pool (choice of 27 blocks is arbitrary), with the forceGlobal flag set
        Then check that:
            a) EvalTop[0:3] contains ${parentPoolAddress + parentHeadersLength} (i.e. the first address in the parent pool after the headers)
            b) The "next free space pointer" header in the parent pool contains ${parentPoolAddress + parentHeadersLength + (27 * 5)} (i.e. the first address after the one just allocated)
            c) The "next free space size" header in the parent pool contains ${NamePool._parentTotalBlocks} - 27
            d) The "next free space size" field in the new first free space contains 0 (meaning there are no more free spaces after this one)
    */
    return "NOT IMPLEMENTED";
}
// Test2- Allocating from local parent pool when there are no expansions and pool is empty
async function test_AllocateNameProc_LocalPoolAllocateWhenEmptyNoExpansions(){
    /*
        Use EvalStack to request a 27 block space on the pool (choice of 27 blocks is arbitrary).  This is the same as for the global scope, but without the forceGlobal flag set.  This will still use the global name pool, but the procedure won't know that.
        Then check that:
            a) EvalTop[0:3] contains ${parentPoolAddress + parentHeadersLength} (i.e. the first address in the parent pool after the headers)
            b) The "next free space pointer" header in the parent pool contains ${parentPoolAddress + parentHeadersLength + (27 * 5)} (i.e. the first address after the one just allocated)
            c) The "next free space size" header in the parent pool contains ${NamePool._parentTotalBlocks} - 27
            d) The "next free space size" field in the new first free space contains 0 (meaning there are no more free spaces after this one)
    */
    return "NOT IMPLEMENTED";
}
// Test3- Allocating from global parent pool when there are no expansions and pool is partially full
async function test_AllocateNameProc_GlobalPoolAllocateWhenPartiallyFullNoExpansions(){
    /*
        Allocate a 50 block space (choice of 50 blocks is arbitrary), then request another one of the same size with the forceGlobal flag set
        Then check that:
            a) EvalTop[0:3] contains ${parentPoolAddress + parentHeadersLength + (50 * 5)} (i.e. the first address after the space we already allocated)
            b) The "next free space pointer" header in the parent pool points to the first address after the newly allocated space
            c) The "next free space size" header in the parent pool contains ${NamePool._parentTotalBlocks - (50 + 50)}
            d) The "next free space size" field in the new first free space contains 0 (meaning there are no more free spaces after this one)
    */
    return "NOT IMPLEMENTED";
}
// Test4- Allocating from local parent pool when there are no expansions and pool is partially full
async function test_AllocateNameProc_LocalPoolAllocateWhenPartiallyFullNoExpansions(){
    /*
        Allocate a 50 block space (choice of 50 blocks is arbitrary), then request another one of the same size
            a) EvalTop[0:3] contains ${parentPoolAddress + parentHeadersLength + (50 * 5)} (i.e. the first address after the space we already allocated)
            b) The "next free space pointer" header in the parent pool points to the first address after the newly allocated space
            c) The "next free space size" header in the parent pool contains ${NamePool._parentTotalBlocks - (50 + 50)}
            d) The "next free space size" field in the new first free space contains 0 (meaning there are no more free spaces after this one)
    */
    return "NOT IMPLEMENTED";
}
// Test5- Allocating from global parent pool when there are no expansions and pool is full
async function test_AllocateNameProc_GlobalAllocateWhenFullNoExpansions(){
    /*
        Allocate ${NamePool._parentTotalBlocks} blocks, and then request 11 blocks (11 is arbitrary) with the forceGlobal flag set
        Then check that:
            a) EvalTop[0:3] contains the first address after the header of a new expansion pool
            b) The "next free space pointer" header in the parent pool points to the first address after the newly allocated space in the expansion pool
            c) The "next free space size" header in the parent pool contains ${NamePool._expansionTotalBlocks - 11}
            d) The "next free space size" field in the new first free space contains 0 (meaning there are no more free spaces after this one)
    */
    return "NOT IMPLEMENTED";
}
// Test6- Allocating from local parent pool when there are no expansions and pool is full
async function test_AllocateNameProc_LocalAllocateWhenFullNoExpansions(){
    /*
        Allocate ${NamePool._parentTotalBlocks} blocks, and then request 11 blocks (11 is arbitrary) with the forceGlobal flag set
        Then check that:
            a) EvalTop[0:3] contains the first address after the header of a new expansion pool
            b) The "next free space pointer" header in the parent pool points to the first address after the newly allocated space in the expansion pool
            c) The "next free space size" header in the parent pool contains ${NamePool._expansionTotalBlocks - 11}
            d) The "next free space size" field in the new first free space contains 0 (meaning there are no more free spaces after this one)
    */
    return "NOT IMPLEMENTED";
}
// Test7- Allocating from global pool when the parent pool is full, and there is 1 partially full expansion
async function test_AllocateNameProc_GlobalPoolAllocateWhenParentFullAnd1PartiallyFullExpansion(){
    /*
        Allocate ${NamePool._parentTotalBlocks} blocks, followed by 50 more (50 is arbitrary).  Then request another 50 with the foreceGlobal flag set
        Then check that:
            a) EvalTop[0:3] contains ${expansionPoolAddress + 1 + (50 * 5)} (+1 as the headers of expansions are only 1 byte).
            b) The "next free space pointer" header in the parent pool points to the first address after the newly allocated space in the expansion pool
            c) The "next free space size" header in the parent pool contains ${NamePool._expansionTotalBlocks - 100}
            d) The "next free space size" field in the new first free space contains 0 (meaning there are no more free spaces after this one)
    */
    return "NOT IMPLEMENTED";
}
// Test8- Allocating from local pool when the parent pool is full, and there is 1 partially full expansion
async function test_AllocateNameProc_LocalPoolAllocateWhenParentFullAnd1PartiallyFullExpansion(){
    /*
        Allocate ${NamePool._parentTotalBlocks} blocks, followed by 50 more (50 is arbitrary).  Then request another 50
        Then check that:
            a) EvalTop[0:3] contains ${expansionPoolAddress + 1 + (50 * 5)} (+1 as the headers of expansions are only 1 byte).
            b) The "next free space pointer" header in the parent pool points to the first address after the newly allocated space in the expansion pool
            c) The "next free space size" header in the parent pool contains ${NamePool._expansionTotalBlocks - 100}
            d) The "next free space size" field in the new first free space contains 0 (meaning there are no more free spaces after this one)
    */
    return "NOT IMPLEMENTED";
}
// Test9- Trying to allocate a space that is too large (i.e. too large to be supported, not just more space than is available)
async function test_AllocateNameProc_AllocateTooLargeSpace(){
    // TODO NEED TO IMPLEMENT THIS WHEN ERROR HANDLING IS SET UP
    return "NOT IMPLEMENTED";
}
// Test10- Trying to allocate from global pool when parent and all expansions are full, and maximum number of expansions has been reached
async function test_AllocateNameProc_GlobalPoolAllocateWhenCompletelyFullAndMaxExpansionsReached(){
    // TODO NEED TO IMPLEMENT THIS WHEN ERROR HANDLING IS SET UP
    return "NOT IMPLEMENTED";
}
// Test11- Trying to allocate from local pool when parent and all expansions are full, and maximum number of expansions has been reached
async function test_AllocateNameProc_LocalPoolAllocateWhenCompletelyFullAndMaxExpansionsReached(){
    // TODO NEED TO IMPLEMENT THIS WHEN ERROR HANDLING IS SET UP
    return "NOT IMPLEMENTED";
}
// Test12- Reallocate deallocated space in global pool
async function test_AllocateNameProc_GlobalPoolAllocateDeallocated(){
    /*
        Allocate the first 5 blocks of the parent pool (5 is arbitary), then allocate the rest of the parent pool by repeatedly allocating 50 blocks (50 is arbitrary)
        Then deallocate a 50 block space somewhere in the middle of the pool (i.e. not at the start or end)
        Then deallocate the first 5 blocks (this must be done after deallocating the 50, as we want the 5 blocks to be referenced by the "first free space" headers)
        All this should be done with the forceGlobal flag set
        Then request 23 blocks (23 is arbitrary, just needs to be smaller than the 50 blocks we deallocated and greater than the 5 blocks we dallocated)
        Then check that:
            a) EvalTop[0:3] contains the first address of the 50 deallocated blocks
            b) The "next free chunk pointer" header points to the first 5 deallocated blocks (it should not have been overwritten when we allocated the 23 blocks)
            c) The "next free chunk size" header contains 5
            d) The "next free chunk pointer" field in the deallocated 5 byte chunk points to the first byte after the space we just allocated
            e) The "next free chunk size" field in the deallocated 5 byte chunk contains 27
            f) The "next free chunk size" field in the chunk after the one we just allocated contains 0, as there are no more free chunks
    */
    return "NOT IMPLEMENTED";
}
// Test13- Reallocate deallocated space in local pool
async function test_AllocateNameProc_LocalPoolAllocateDeallocated(){
    /*
        Allocate the first 5 blocks of the parent pool (5 is arbitary), then allocate the rest of the parent pool by repeatedly allocating 50 blocks (50 is arbitrary)
        Then deallocate a 50 block space somewhere in the middle of the pool (i.e. not at the start or end)
        Then deallocate the first 5 blocks (this must be done after deallocating the 50, as we want the 5 blocks to be referenced by the "first free space" headers)
        Then request 23 blocks (23 is arbitrary, just needs to be smaller than the 50 blocks we deallocated and greater than the 5 blocks we dallocated)
        Then check that:
            a) EvalTop[0:3] contains the first address of the 50 deallocated blocks
            b) The "next free chunk pointer" header points to the first 5 deallocated blocks (it should not have been overwritten when we allocated the 23 blocks)
            c) The "next free chunk size" header contains 5
            d) The "next free chunk pointer" field in the deallocated 5 byte chunk points to the first byte after the space we just allocated
            e) The "next free chunk size" field in the deallocated 5 byte chunk contains 27
            f) The "next free chunk size" field in the chunk after the one we just allocated contains 0, as there are no more free chunks
    */
    return "NOT IMPLEMENTED";
}



tests_all = tests_all.concat(tests_constantProcedures);