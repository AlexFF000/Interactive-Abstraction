/*
    Automated tests for testing code generation functions related to storage and retrieval of data (e.g. variables etc...)
*/
var tests_dataFunctions = [];

/*
    DECLARE.
    Function for declaring variables
*/
var tests_DECLARE = [test_DECLARE_globalVarTableWithoutForceGlobal, test_DECLARE_globalVarTableWithForceGlobal, test_DECLARE_localVarTable, test_DECLARE_functionPrototypeTable, test_DECLARE_classPrototypeTable];
tests_dataFunctions = tests_dataFunctions.concat(tests_DECLARE);
let declareTests_neededSetup = [setupReservedArea, setupIntFloatPool, setupConstantProcedures, setupGlobalHeap, setupGlobalVarTable, setupGlobalNamePool];

// Test1- Add variable to the global variable table, without the forceGlobal flag
async function test_DECLARE_globalVarTableWithoutForceGlobal(){
    /*
        Declare a variable called "testVar" and check that:
            a) Bytes 2-5 (the name address field) of the second slot (the first slot will already be the parent entry) in the global VarTable contains an address from the global name pool
            b) The address pointed to by the name address field is a name containing "testVar"
            c) Bytes 6-9 (the data pointer) of the second slot in the global VarTable contains null
    */
    await runSetup(declareTests_neededSetup);
    let globalVarTable = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.VarTablePointer, 4);
    let globalNamePool = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.NamePoolPointer, 4);
    let name = new Name("testVar");
    let modifiers = new Modifiers();
    let parameters = [name, modifiers];
    await runInstructions(DECLARE(parameters, testsInstructionsStart), false, true);
    let firstSlot = globalVarTable + VarTable._parentHeadersLength + VarTable._entryLength;
    // Check a
    let nameAddress = readMemoryAsInt(firstSlot + 2, 4);
    if (!(globalNamePool <= nameAddress && nameAddress < globalNamePool + runtime_options.NamePoolSize)) return "Assertion Error: Value is not in expected range";
    // Check b
    for (let i = 0; i < name.bytes.length; i++){
        if (readMemoryAsInt(nameAddress + i, 1) !== name.bytes[i]) return "Assertion Error: Values do not match";
    }
    // Check c
    return assertMemoryEqualToInt(Addresses.NullAddress, firstSlot + 6, 4);
}
// Test2- Add variable to the global variable table, with the forceGlobal flag
async function test_DECLARE_globalVarTableWithForceGlobal(){return "NOT IMPLEMENTED";
}
// Test3- Add variable to a local variable table
async function test_DECLARE_localVarTable(){
    // TODO: Need to implement when local scopes are set up
    return "NOT IMPLEMENTED";
}
// Test4- Add variable to function prototype table
async function test_DECLARE_functionPrototypeTable(){
    // TODO: Need to implement when function definitions are set up
    return "NOT IMPLEMENTED";
}
// Test5- Add field to class prototype table
async function test_DECLARE_classPrototypeTable(){
    // TODO: Need to implement when class definitions are set up
    return "NOT IMPLEMENTED";
}
