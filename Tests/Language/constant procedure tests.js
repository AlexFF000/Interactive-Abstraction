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
}
// Test3- Trying to allocate when pool is full (it should allocate from the heap instead, and the pool should not be modified)
async function AllocationProc_testGlobalPoolAllocateWhenFull(){
    // Fill all of the free spaces in the pool, incrementing PoolFreePointer accordingly
    // Then use Eval stack to request a space and run the procedure
    /* Then afterwards check that:
        a) The top value on the Eval stack contains an address, but not one from inside the pool
        b) The PoolFreePointer has not been changed


    */
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
}
