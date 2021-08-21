/*
    Automated tests for testing arithmetic code generation functions
*/

/*
    add32BitIntegers
    Function for adding two 32 bit integers, and leaving the result in ps3
*/
tests_add32BitIntegers = [test_add32BitIntegers_nonLiterals, test_add32BitIntegers_zero_add_zero, test_add32BitIntegers_commutative, test_add32BitIntegers_carry, test_add32BitIntegers_largePos, test_add32BitIntegers_posAddNegForNeg, test_add32BitIntegers_posAddNegForPos, test_add32BitIntegers_negAddNegForNeg]

// Test1- providing non-literals
async function test_add32BitIntegers_nonLiterals(){
    // Load 3000 into ps5, and provide ps5 as int1, and literal 5 as int2.  Check ps3 contains 3005
    // Then load 3000 into ps5 again, and provide literal 5 as int1 and ps5 as int2.  Check again ps3 contains 3005
    // Then load 3000 into ps5 again, and 5 into ps6.  Provide ps5 as int1 and ps6 and int2.  Check again ps3 contains 3005
    await runInstructions(writeMultiByte(3000, Addresses.ps5, 4), true, true);
    await runInstructions(add32BitIntegers(Addresses.ps5, 5, 0, false, true), false, true);
    let checkResult = assertMemoryEqualToInt(3005, Addresses.ps3, 4);
    if (checkResult !== true) return checkResult;
    await runInstructions(writeMultiByte(3000, Addresses.ps5, 4), true, true);
    await runInstructions(add32BitIntegers(5, Addresses.ps5, 0, true, false), false, true);
    checkResult = assertMemoryEqualToInt(3005, Addresses.ps3, 4);
    if (checkResult !== true) return checkResult;
    await runInstructions(writeMultiByte(3000, Addresses.ps5, 4).concat(writeMultiByte(5, Addresses.ps6, 4)), true, true);
    await runInstructions(add32BitIntegers(Addresses.ps5, Addresses.ps6, 0), false, true);
    return assertMemoryEqualToInt(3005, Addresses.ps3, 4);

}
// Test2- Zero add zero
async function test_add32BitIntegers_zero_add_zero(){
    // Run the procedure with the values 0 and 0, and afterwards check that ps3 contains 0
    await runInstructions(add32BitIntegers(0, 0, 0, true, true), true, true);
    return assertMemoryEqualToInt(0, Addresses.ps3, 4);
}
// Test3- Commutative
async function test_add32BitIntegers_commutative(){
    // Run 11 + 12, and then 12 + 11 and check the result is the same for both
    await runInstructions(add32BitIntegers(11, 12, 0, true, true), true, true);
    let firstResult = readMemoryAsInt(Addresses.ps3, 4);
    await runInstructions(add32BitIntegers(12, 11, 0, true, true), true, true);
    return assertMemoryEqualToInt(firstResult, Addresses.ps3, 4);
}
// Test4- Carry
async function test_add32BitIntegers_carry(){
    // Add 1 to 16777215 (as 16777215 sets the 3 LSBytes to 1, so adding 1 will cause all of these to carry) and check that ps3 contains 16777216
    await runInstructions(add32BitIntegers(16777215, 1, 0, true, true), true, true);
    return assertMemoryEqualToInt(16777216, Addresses.ps3, 4);
}
// Test5- Adding large positive numbers
async function test_add32BitIntegers_largePos(){
    // Add 1073741840 and 1073741806 and check if ps3 contains 2147483646
    await runInstructions(add32BitIntegers(1073741840, 1073741806, 0, true, true), true, true);
    return assertMemoryEqualToInt(2147483646, Addresses.ps3, 4);
}
// Test6- Positive + Negative to get Negative
async function test_add32BitIntegers_posAddNegForNeg(){
    // Add -301502603 (3993464693) to +7 and check if ps3 contains -301502596 (3993464700)
    await runInstructions(add32BitIntegers(7, 3993464693, 0, true, true), true, true);
    return assertMemoryEqualToInt(3993464700, Addresses.ps3, 4);
}
// Test7 Positive + Negative to get Positive
async function test_add32BitIntegers_posAddNegForPos(){
    // Add -7 (4294967289) to 301502603 and check if ps3 contains 301502596
    await runInstructions(add32BitIntegers(301502603, 4294967289, 0, true, true), true, true);
    return assertMemoryEqualToInt(301502596, Addresses.ps3, 4);
}
// Test8 Negative + Negative to get Negative
async function test_add32BitIntegers_negAddNegForNeg(){
    // Add -7 (4294967289) to -301502603 (3993464693) and check if ps3 contains -301502610 (3993464686)
    await runInstructions(add32BitIntegers(4294967289, 3993464693, 0, true, true), true, true);
    return assertMemoryEqualToInt(3993464686, Addresses.ps3, 4);
}