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