/*
    Automated tests for testing runtime constant procedures.
    The tests use functions from the testing.js file.
    Before running replace **place procedure here** with the code of the procedure to be tested
*/

/* 
    Base2ExponentProc
    Procedure for calculating a 32 bit value for 2^x where x is between 0 and 31
    Should take the exponent as an 8 bit value in ps0[0], and leave the 32 bit result in ps0
    Should return to address in psReturnAddr afterwards
*/

// Test1 (will simply test whether it puts the correct value in ps0 for each exponent from 0 to 32)
async function Base2ExponentProc_testAllValues(){
    for (let exp = 0; exp < 32; exp++){
        // Calculate the result with js
        let result = 2 ** exp;
        let binResult = [];
        for (let i = 0; i < 4; i++) binResult.push(intToBinArray(getByteOfInt(result, i)));
        // Run the Base2ExponentProc code
        await runInstructions([
            // 240 will write the equivalent machine code to an END instruction
            "AND 0",
            "ADD 240",
            // Write the end instruction to 16384 (16384 chosen as it only requires modifying one byte of psReturnAddress to point to it)
            "WRT 16384",
            // Point psReturnAddr to the end instruction
            "AND 0",
            "ADD 64",
            `WRT ${Addresses.psReturnAddr + 2}`,
            // Now write the exponent to be calculated to ps0
            "AND 0",
            `ADD ${exp}`,
            `WRT ${Addresses.ps0}`,
            "GTO #base2Exponent"  // This goto is unneccessary, as these instructions are immediately followed by the base2Exponent instructions anyway, but in actual use it would be jumped to so this is how it should be tested (though it should make no difference)
        ].concat(Base2ExponentProc)
        );
        // Now check if ps0 contains the correct value
        let assertionResult = assertMemoryEqual(binResult, Addresses.ps0, 4);
        if (assertionResult !== true) return `Test Failed with exp = ${exp}: ${assertionResult}`;
    }
    // Test passed for all exponents
    return true;
}

/*
    AllocationProc
    Procedure for allocating memory
*/

// Tests for allocating on the int/float pool

// Test1- Allocating when the pool is empty
async function AllocationProc_testGlobalPoolAllocateWhenEmpty(){
    // Use Eval stack to request a space on the int/float pool then run the procedure
    /* Then afterwards check that:
        a) The top value on the Eval stack contains the starting address of the pool
        b) The PoolFreePointer points to the 6th byte of the pool
        c) The first four bytes of the next space after the one allocated (i.e. the 6th to 10th bytes of the pool) contain 0 (showing that there is no previously deallocated space)
    */
   let code = IntermediateFunctions["SETUP"]();
   // Add END instruction to jump back ot afterwards
   code.push(
        "GTO #test_afterEndInstruction",
    );
    let endInstructionAddr = calculateInstructionsLength(code);
    code.concat(
    [
        "END",
        "#test_afterEndInstruction",
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
    AllocationProc
    );
   await runInstructions(code);

   // Check a
   let checkResult = assertMemoryEqual(Addresses.IntFloatPool, Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
   if (checkResult !== true) return checkResult;
   // Check b
   checkResult = assertMemoryEqual(Addresses.IntFloatPool + 5, Addresses.PoolFreePointer, 4);
   if (checkResult !== true) return checkResult;
   // Check c
   return assertMemoryEqual(0, Addresses.IntFloatPool + 5, 4);
}
// Test2- Allocating when pool is not empty, but not full
async function AllocationProc_testGlobalPoolAllocateWhenHalfFull(){
    // Fill half of the free spaces in the pool, incrementing the PoolFreePointer accordingly
    // Then use Eval stack to request a space and run the procedure
    /* Then afterwards check that:
        a) The top value on the Eval stack contains the starting address of the first block after those that have been filled
        b) The PoolFreePointer points to the starting address of the next space
        c) The first four bytes of the next space after the one allocated contain 0
    */
   // Run setup first as it will overwrite PoolFreePointer
   runInstructions(IntermediateFunctions["SETUP"]());
   let poolMidSlot = Addresses.IntFloatPool + ((runtime_options.IntFloatPoolSize - 5) / 2);
   writeIntToMemory(poolMidSlot, Addresses.PoolFreePointer, 4);
   // Add END instruction to jump back ot afterwards
    let code = ["GTO #test_afterEndInstruction"];
    let endInstructionAddr = calculateInstructionsLength(code);
    code.concat(
    [
        "END",
        "#test_afterEndInstruction",
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
    AllocationProc
    );
   await runInstructions(code, false);

   // check a
   let checkResult = assertMemoryEqual(poolMidSlot, Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
   if (checkResult !== true) return checkResult;
   // check b
   checkResult = assertMemoryEqual(poolMidSlot + 5, Addresses.PoolFreePointer, 4);
   if (checkResult !== true) return checkResult;
   // check c
   return assertMemoryEqual(0, poolMidSlot + 5, 4);
}
// Test3- Trying to allocate when pool is full (it should allocate from the heap instead, and the pool should not be modified)
async function AllocationProc_testGlobalPoolAllocateWhenFull(){
    // Fill all of the free spaces in the pool, incrementing PoolFreePointer accordingly
    // Then use Eval stack to request a space and run the procedure
    /* Then afterwards check that:
        a) The top value on the Eval stack contains an address, but not one from inside the pool
        b) The PoolFreePointer has not been changed
    */
   runInstructions(IntermediateFunctions["SETUP"]());
   writeIntToMemory(Addresses.IntFloatPool + runtime_options.IntFloatPoolSize, Addresses.PoolFreePointer, 4);
   // Add END instruction to jump back to afterwards
    let code = ["GTO #test_afterEndInstruction"];
    let endInstructionAddr = calculateInstructionsLength(code);
    code.concat(
    [
        "END",
        "#test_afterEndInstruction",
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
    AllocationProc
    );
   await runInstructions(code, false);
   
   // Check a
   let allocatedAddress = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
   if (Addresses.IntFloatPool <= allocatedAddress && allocatedAddress < Addresses.IntFloatPool + runtime_options.IntFloatPoolSize) return `Test failed on check A: Allocated address (${allocatedAddress}) is in the pool`;
   // Check b
   return assertMemoryEqual(Addresses.IntFloatPool + runtime_options.IntFloatPoolSize, Addresses.PoolFreePointer, 4);
}
// Test4- Reallocating previously deallocated space
async function AllocationProc_testGlobalPoolReallocateDeallocated(){
    // Fill half of the free spaces in the pool, then deallocate one of these spaces (but not one at the start or end)
    // Then use Eval stack to request a space and run the procedure
    /*
        Then afterwards check that:
            a) The top value on the Eval stack contains the starting address of the deallocated space
            b) The PoolFreePointer points to the first space after the halfway point (a new space should not have been allocated)
    */
    runInstructions(IntermediateFunctions["SETUP"]());
    let poolMidSlot = Addresses.IntFloatPool + ((runtime_options.IntFloatPoolSize - 5) / 2);
    // Use the 10th space as the free one (the choice of 10th is arbitrary)
    let freeSlot = Addresses.IntFloatPool + (5 * 10);
    writeIntToMemory(poolMidSlot, freeSlot, 4);
    writeIntToMemory(freeSlot, Addresses.PoolFreePointer, 4);
    // Add END instruction to jump back to afterwards
    let code = ["GTO #test_afterEndInstruction"];
    let endInstructionAddr = calculateInstructionsLength(code);
    code.concat(
    [
        "END",
        "#test_afterEndInstruction",
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
    AllocationProc
    );
   await runInstructions(code, false);

   // Check a
   let checkResult = assertMemoryEqual(freeSlot, Addresses.GlobalArea + Offsets.frame.EvalStart, 4);
   if (checkResult !== true) return checkResult;
   // Check b
   return assertMemoryEqual(poolMidSlot, Addresses.PoolFreePointer, 4);
}

// Tests for allocation on global heap

// Test5- Allocating when heap is empty
async function AllocationProc_testGlobalHeapAllocateWhenEmpty(){
    // Request the smallest allowed space on the heap (32 bytes) and run the procedure
    /*
        Then afterwards check that:
            a) The top value on the eval stack is the starting address of the heap (meaning the correct bytes, the first 32, have been allocated)
            b) The chunkStart pointer points to the 33rd byte of the heap, and the chunkEnd pointer points to the last byte in the heap (meaning the free chunk contains the entire heap but the allocated 32 bytes)
            c) The 2nd - 5th bytes of the free chunk contain 0 (meaning there is no next free chunk)
            d)  Starting from 0, heap[32] contains "5", heap[64] and heap[128] contain "6", heap[192] and heap[320] contain "7", this pattern continues and ends with the first byte in the second half of the heap, which contains x-1 where x is the size of the heap as an exponent of 2
    */
}
// Test 6- Allocating when heap is partially full
async function AllocationProc_testGlobalHeapAllocateWhenPartiallyFull(){
    // Request 4096 bytes after already allocating 64 bytes
    /*
        Then afterwards check that:
            a) The top value on the eval stack is heap[4096]
            b) The chunkStart pointer points to heap[64], and the chunkEnd pointer points to heap[4095]
            c) The first free chunk's next start pointer at heap[65-68] points to heap[8192], and heap[69-72] points to the last byte of the heap (as there should now be two free chunks, separated by the 4096 bytes just allocated)
            d) The second free chunk's next start pointer at heap[8193-8196] contains 0 (as there are no more free chunks)
    */
}
// Test7- Allocating when heap has no large enough blocks
async function AllocationProc_testGlobalHeapInsufficientSpace(){
    // Allocate a 32 byte block, followed by three 2^(x-2) byte blocks (where x is the heap size as an exponent of 2)
    // Then request another 2^(x-2) bytes.  This should cause a NOT ENOUGH SPACE error
}
// Test8- Allocating from deallocated space
async function AllocationProc_testGlobalHeapReallocateDeallocated(){
    // Allocate a 32 byte block, followed by three 2^(x-2) byte blocks (where x is the heap size as an exponent of 2)
    // Then deallocate the block starting at the halfway point of the heap
    // Then request another 2^(x-2) block
    // Then check that the top value on the eval stack is the address of the first byte after the midpoint of the heap (meaning the deallocated space was reallocated)
}

// Tests for allocation within stack frame

// Test9- Allocating when frame heap is empty
async function AllocationProc_testFrameHeapAllocateWhenEmpty(){
    // Request the smallest allowed space (32 bytes) and run the procedure
    /*
        Then afterwards check that:
            a) The top value on the eval stack is the first byte of the frame heap
            b) firstChunkStart points to frame heap start + 32
            c) The first four bytes of the free chunk contain the number of bytes between the end of the newly allocated space, and the end of the stack
            d) The following eight bytes all contain 0, as there should be no following free chunk
    */
}
// Test10- Allocating when there is not enough space left on stack
async function AllocationProc_testFrameHeapInsufficientSpace(){
    // Request an amount of space larger than what is left on the stack and run the procedure
    // This should throw a NOT ENOUGH SPACE error
}
// Test11- Allocating from deallocated space
async function AllocationProc_testFrameHeapReallocateDeallocated(){
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