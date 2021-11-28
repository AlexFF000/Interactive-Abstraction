/*
    Automated tests for testing arithmetic code generation functions
*/
var tests_arithmeticFunctions = [];

/*
    add32BitIntegers
    Function for adding two 32 bit integers, and leaving the result in ps3
*/
var tests_add32BitIntegers = [test_add32BitIntegers_nonLiterals, test_add32BitIntegers_zero_add_zero, test_add32BitIntegers_commutative, test_add32BitIntegers_carry, test_add32BitIntegers_largePos, test_add32BitIntegers_posAddNegForNeg, test_add32BitIntegers_posAddNegForPos, test_add32BitIntegers_negAddNegForNeg]
tests_arithmeticFunctions = tests_arithmeticFunctions.concat(tests_add32BitIntegers);

// Test1- providing non-literals
async function test_add32BitIntegers_nonLiterals(){
    // Load 3000 into ps5, and provide ps5 as int1, and literal 5 as int2.  Check ps3 contains 3005
    // Then load 3000 into ps5 again, and provide literal 5 as int1 and ps5 as int2.  Check again ps3 contains 3005
    // Then load 3000 into ps5 again, and 5 into ps6.  Provide ps5 as int1 and ps6 as int2.  Check again ps3 contains 3005
    await runInstructions(writeMultiByte(3000, Addresses.ps5, 4), true, true);
    await runInstructions(add32BitIntegers(Addresses.ps5, 5, testsInstructionsStart, false, true), false, true);
    let checkResult = assertMemoryEqualToInt(3005, Addresses.ps3, 4);
    if (checkResult !== true) return checkResult;
    await runInstructions(writeMultiByte(3000, Addresses.ps5, 4), true, true);
    await runInstructions(add32BitIntegers(5, Addresses.ps5, testsInstructionsStart, true, false), false, true);
    checkResult = assertMemoryEqualToInt(3005, Addresses.ps3, 4);
    if (checkResult !== true) return checkResult; 
    await runInstructions(writeMultiByte(3000, Addresses.ps5, 4).concat(writeMultiByte(5, Addresses.ps6, 4)), true, true);
    await runInstructions(add32BitIntegers(Addresses.ps5, Addresses.ps6, testsInstructionsStart), false, true);
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

/*
    sub32BitInteger
    Function for subtracting one 32 bit integer (subtrahend) from another (minuend), leaving the result in ps3
*/
var tests_sub32BitInteger = [test_sub32BitInteger_nonLiterals, test_sub32BitInteger_posSubPosForPos, test_sub32BitInteger_posSubPosForNeg, test_sub32BitInteger_posSubNegForPos, test_sub32BitInteger_negSubNegForPos, test_sub32BitInteger_negSubNegForNeg, test_sub32BitInteger_negSubPosForNeg];
tests_arithmeticFunctions = tests_arithmeticFunctions.concat(tests_sub32BitInteger);

// Test1 Providing non-literals
async function test_sub32BitInteger_nonLiterals(){
    // Load 3000 into ps5, and provide ps5 as minuend, and literal 5 as subtrahend.  Check ps3 contains 2995
    // Then load 3000 into ps5 again, and provide literal 4000 as minuend and ps5 as subtrahend.  Check ps3 contains 1000
    // Then load 3000 into ps5 again, and 5 into ps6.  Provide ps5 as minuend and ps6 as subtrahend.  Check ps3 contains 2995
    await runInstructions(writeMultiByte(3000, Addresses.ps5, 4), true, true);
    await runInstructions(sub32BitInteger(Addresses.ps5, 5, testsInstructionsStart, false, true), false, true);
    let checkResult = assertMemoryEqualToInt(2995, Addresses.ps3, 4);
    if (checkResult !== true) return checkResult;
    await runInstructions(writeMultiByte(3000, Addresses.ps5, 4), true, true);
    await runInstructions(sub32BitInteger(4000, Addresses.ps5, testsInstructionsStart, true, false), false, true);
    checkResult = assertMemoryEqualToInt(1000, Addresses.ps3, 4);
    if (checkResult !== true) return checkResult; 
    await runInstructions(writeMultiByte(3000, Addresses.ps5, 4).concat(writeMultiByte(5, Addresses.ps6, 4)), true, true);
    await runInstructions(sub32BitInteger(Addresses.ps5, Addresses.ps6, testsInstructionsStart), false, true);
    return assertMemoryEqualToInt(2995, Addresses.ps3, 4);
}
// Test2 Positive - Positive to get Positive
async function test_sub32BitInteger_posSubPosForPos(){
    // Subtract 102348 from 2147483647 and check if ps3 contains 2147381299
    await runInstructions(sub32BitInteger(2147483647, 102348, 0, true, true), true, true);
    return assertMemoryEqualToInt(2147381299, Addresses.ps3, 4);
}
// Test3 Positive - Positive to get Negative
async function test_sub32BitInteger_posSubPosForNeg(){
    // Subtract 2147483647 from 102348 and check if ps3 contains -2147381299 (2147585997)
    await runInstructions(sub32BitInteger(102348, 2147483647, 0, true, true), true, true);
    return assertMemoryEqualToInt(2147585997, Addresses.ps3, 4);
}
// Test4 Positive - Negative to get Positive
async function test_sub32BitInteger_posSubNegForPos(){
    // Subtract -5 (4294967291) from 122356 and check if ps3 contains 122361
    await runInstructions(sub32BitInteger(122356, 4294967291, 0, true, true), true, true);
    return assertMemoryEqualToInt(122361, Addresses.ps3, 4);
}
// Test5 Negative - Negative to get Positive
async function test_sub32BitInteger_negSubNegForPos(){
    // Subtract -1496302416 (2798664880) from -1290182345 (3004784951) and check if ps3 contains 206120071
    await runInstructions(sub32BitInteger(3004784951, 2798664880, 0, true, true), true, true);
    return assertMemoryEqualToInt(206120071, Addresses.ps3, 4);
}
// Test6 Negative - Negative to get Negative
async function test_sub32BitInteger_negSubNegForNeg(){
    // Subtract -1290182345 (3004784951) from -1496302416 (2798664880) and check if ps3 contains -206120071 (4088847225)
    await runInstructions(sub32BitInteger(2798664880, 3004784951, 0, true, true), true, true);
    return assertMemoryEqualToInt(4088847225, Addresses.ps3, 4);
}
// Test7 Negative - Positive to get Negative
async function test_sub32BitInteger_negSubPosForNeg(){
    // Subtract 122356 from -5 (4294967291) and check if ps3 contains -122361 (4294844935)
    await runInstructions(sub32BitInteger(4294967291, 122356, 0, true, true), true, true);
    return assertMemoryEqualToInt(4294844935, Addresses.ps3, 4);
}

/*
    checkGreaterUnsignedByte
    Function for finding the greater of two unsigned bytes
*/
tests_arithmeticFunctions.push(test_checkGreaterUnsignedByte_checkAllCombinations);
tests_longRunning.push(test_checkGreaterUnsignedByte_checkAllCombinations);  // This one takes a long time to run, so add to tests_longRunning so it can be skipped over
let checkGreaterUnsignedByteTests_neededSetup = [setupReservedArea];

// Test1- Compare every unsigned 8 bit number against every other unsigned 8 bit number
async function test_checkGreaterUnsignedByte_checkAllCombinations(){
    let exitProcedureIfGreater = [
        // If i is greater, place 1 in ps1
        "AND 0",
        "ADD 1",
        `WRT ${Addresses.ps1}`,
        "END"
    ];
    let exitProcedureIfNotGreater = [
        // If i isn't greater, place 2 in ps1
        "AND 0",
        "ADD 2",
        `WRT ${Addresses.ps1}`,
        "END"
    ];
    let functionLen = testsInstructionsStart + calculateInstructionsLength(checkGreaterUnsignedByte(Addresses.ps0, Addresses.ps0 + 1, 1234, 1234, 0).concat(["END"]));
    let code = checkGreaterUnsignedByte(Addresses.ps0, Addresses.ps0 + 1, functionLen, functionLen + calculateInstructionsLength(exitProcedureIfGreater), testsInstructionsStart);
    // Add an "END" instruction to the end of the procedure to make sure that we can't accidentally get the right answer by not branching anywhere
    code.push("END");
    code = code.concat(exitProcedureIfGreater, exitProcedureIfNotGreater);
    for (let i = 0; i < 255; i++){
        for (let j = 0; j < 255; j++){
            let correctResult = j < i ? 1 : 2;
            await runSetup(checkGreaterUnsignedByteTests_neededSetup);
            // Load in i and j
            writeIntToMemory(i, Addresses.ps0, 1);
            writeIntToMemory(j, Addresses.ps0 + 1, 1);
            await runInstructions(code, false, false);
            let checkResult = assertMemoryEqualToInt(correctResult, Addresses.ps1, 1);
            if (checkResult !== true) return checkResult;
        }
    }
    return true;
}

tests_all = tests_all.concat(tests_arithmeticFunctions);