/*
    Automated tests for testing structures
*/

/*
    Tests for evaluation stack
*/
let tests_EvalStack = [test_EvalStack_addLayerWhenEmpty, test_EvalStack_addLayerWhenPartiallyFull, test_EvalStack_addLayerWhenFull, test_EvalStack_removeLayerWhenNotEmpty, test_EvalStack_removeLayerWhenEmpty, test_EvalStack_writeLiteralToTopLayer, test_EvalStack_copyToTopLayer, test_EvalStack_writeLiteralToNewLayer, test_EvalStack_copyToNewLayer];

// Test1- Add a new layer when there are no layers on the stack
async function test_EvalStack_addLayerWhenEmpty(){
    /* Add a new layer, then check that:
        a) EvalSlotsUsed contains 1
        b) EvalTop has been incremented by 5
    */
   await runSetup();
   let originalEvalTopAddr = readMemoryAsInt(Addresses.EvalTop, 4);
   await runInstructions(EvalStack.addLayer(testsInstructionsStart), false, true);
   // Check a
   let checkResult = assertMemoryEqualToInt(1, Addresses.EvalSlotsUsed, 1);
   if (checkResult !== true) return checkResult;
   // Check b
   return assertMemoryEqualToInt(originalEvalTopAddr + 5, Addresses.EvalTop, 4);
}
// Test2- Add a new layer when there are already layers on the stack
async function test_EvalStack_addLayerWhenPartiallyFull(){
    /*
        Set EvalTop and EvalSlotsUsed so that 5 layers are already on the stack, then try to add another
        Then check that:
            a) EvalSlotsUsed contains 6
            b) EvalTop has been incremented by 5
    */
   await runSetup();
   let originalEvalTopAddr = readMemoryAsInt(Addresses.EvalTop, 4);
   writeIntToMemory(originalEvalTopAddr + (5 * 5), Addresses.EvalTop, 4);
   writeIntToMemory(5, Addresses.EvalSlotsUsed, 1);
   await runInstructions(EvalStack.addLayer(testsInstructionsStart), false, true);
   // Check a
   let checkResult = assertMemoryEqualToInt(6, Addresses.EvalSlotsUsed, 1);
   if (checkResult !== true) return checkResult;
   // Check b
   return assertMemoryEqualToInt(originalEvalTopAddr + (6 * 5), Addresses.EvalTop, 4);
}
// Test3- Try to add a new layer when the stack is already full
async function test_EvalStack_addLayerWhenFull(){ return "NOT IMPLEMENTED"; }
// Test4- Remove a layer when the stack is not empty
async function test_EvalStack_removeLayerWhenNotEmpty(){
    /*
        Set EvalTop and EvalSlotsUsed so that 5 layers are already on the stack, and try to remove one
        Then after check that:
            a) EvalSlotsUsed contains 4
            b) EvalTop has been decremented by 5
    */
   await runSetup();
   let originalEvalTopAddr = readMemoryAsInt(Addresses.EvalTop, 4);
   writeIntToMemory(originalEvalTopAddr + (5 * 5), Addresses.EvalTop, 4);
   writeIntToMemory(5, Addresses.EvalSlotsUsed, 1);
   await runInstructions(EvalStack.removeLayer(testsInstructionsStart), false, true);
   // Check a
   let checkResult = assertMemoryEqualToInt(4, Addresses.EvalSlotsUsed, 1);
   if (checkResult !== true) return checkResult;
   // Check b
   return assertMemoryEqualToInt(originalEvalTopAddr + (4 * 5), Addresses.EvalTop, 4);
}
// Test5- Try to remove a layer when the stack is already empty
async function test_EvalStack_removeLayerWhenEmpty(){
    /*
        Try to remove a layer from EvalStack when it is empty, and then check that EvalTop and EvalSlotsUsed have not changed (meaning nothing was removed)
    */
   await runSetup();
   let originalEvalTopAddr = readMemoryAsInt(Addresses.EvalTop, 4);
   writeIntToMemory(0, Addresses.EvalSlotsUsed, 1);
   await runInstructions(EvalStack.removeLayer(testsInstructionsStart), false, true);
   let checkResult = assertMemoryEqualToInt(0, Addresses.EvalSlotsUsed, 1);
   if (checkResult !== true) return checkResult;
   return assertMemoryEqualToInt(originalEvalTopAddr, Addresses.EvalTop, 4);
}
// Test6- Write literal to top layer
async function test_EvalStack_writeLiteralToTopLayer(){
    /*
        Try to write to the top layer, then check that it has been written
    */
   await runSetup();
   let originalEvalTopAddr = readMemoryAsInt(Addresses.EvalTop, 4);
   writeIntToMemory(originalEvalTopAddr + 5, Addresses.EvalTop, 4);
   writeIntToMemory(1, Addresses.EvalSlotsUsed, 1);
   await runInstructions(EvalStack.writeToTopLayer([5, 6, 7, 8, 9], testsInstructionsStart), false, true);
   let checkResult;
   for (let i = 5; i < 10; i++){
        checkResult = assertMemoryEqualToInt(i, originalEvalTopAddr + 5 + (i - 5), 1);
        if (checkResult !== true) return checkResult;
   }
   return true;
}
// Test7- Copy data to top layer
async function test_EvalStack_copyToTopLayer(){
    /*
        Try to copy to the top layer, then check that it has been written
    */
    await runSetup();
    let originalEvalTopAddr = readMemoryAsInt(Addresses.EvalTop, 4);
    writeIntToMemory(originalEvalTopAddr + 5, Addresses.EvalTop, 4);
    writeIntToMemory(1, Addresses.EvalSlotsUsed, 1);
    for (let i = 5; i < 10; i++) writeIntToMemory(i, Addresses.ps0 + (i - 5), 1);
    await runInstructions(EvalStack.copyToTopLayer(Addresses.ps0, testsInstructionsStart), false, true);
    let checkResult;
    for (let i = 5; i < 10; i++){
        checkResult = assertMemoryEqualToInt(i, originalEvalTopAddr + 5 + (i - 5), 1);
        if (checkResult !== true) return checkResult;
    }
    return true;
}
// Test8- Write literal to new layer
async function test_EvalStack_writeLiteralToNewLayer(){
    /*
        Try to create and write to new layer, then check that it has been written
    */
    await runSetup();
    let originalEvalTopAddr = readMemoryAsInt(Addresses.EvalTop, 4);
    await runInstructions(EvalStack.pushLiteral([5, 6, 7, 8, 9], testsInstructionsStart), false, true);
    let checkResult;
    for (let i = 5; i < 10; i++){
        checkResult = assertMemoryEqualToInt(i, originalEvalTopAddr + 5 + (i - 5), 1);
        if (checkResult !== true) return checkResult;
    }
    return true;
}
// Test9- Copy data to new layer
async function test_EvalStack_copyToNewLayer(){
    /*
        Try to create and copy data to new layer, then check that it has been written
    */
   await runSetup();
   let originalEvalTopAddr = readMemoryAsInt(Addresses.EvalTop, 4);
   for (let i = 5; i < 10; i++) writeIntToMemory(i, Addresses.ps7 + (i - 5), 1);
   await runInstructions(EvalStack.copyToNewLayer(Addresses.ps7, testsInstructionsStart), false, true);
   let checkResult;
    for (let i = 5; i < 10; i++){
        checkResult = assertMemoryEqualToInt(i, originalEvalTopAddr + 5 + (i - 5), 1);
        if (checkResult !== true) return checkResult;
    }
    return true;
}

/*
    Tests for Tables
*/
/* Tests for Variable Tables */
let tests_VarTable = [test_VarTable_createCheckCorrectFormat, test_VarTable_createCheckSlotsClear, test_VarTable_createCheckParentEntry];

// Test1- Create table, and check it is is in the correct format (has all the correct headers)
async function test_VarTable_createCheckCorrectFormat(){
    /*
        Allocate space for and create a new global variable table
        Then check that:
            a) The first byte of the allocated space contains the type tag for variable tables
            b) AllocatedSpace[1:2] (0 indexed) contains 1 (the number of entries in the table, should be 1 as the "parent" entry should have been added)
            c) AllocatedSpace[3] contains 0 (the number of expansion tables, 0 as there aren't any yet)
            d) AllocatedSpace[4:5] contains 2 (the index of the next free slot in the table, should be 2 as the index starts from 1 to allow 0 to represent any empty table, and the first space is already taken by the "parent" entry)
    */
   await runSetup();
   // As table will be allocated globally straight after setup, it will be located at the start of the heap
   let tableAddress = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
   await runInstructions(VarTable.create(0, Addresses.NullAddress), false, true);
   // Check a
   let checkResult = assertMemoryEqualToInt(type_tags.var_table, tableAddress, 1);
   if (checkResult !== true) return checkResult;
   // Check b
   checkResult = assertMemoryEqualToInt(1, tableAddress + 1, 2);
   if (checkResult !== true) return checkResult;
   // Check c
   checkResult = assertMemoryEqualToInt(0, tableAddress + 3, 1);
   if (checkResult !== true) return checkResult;
   // Check d
   return assertMemoryEqualToInt(2, tableAddress + 4, 2);
}
// Test2- Create table, and check all of the empty slots have been cleared
async function test_VarTable_createCheckSlotsClear(){
    /*
        Allocate space for and create a new global variable table
        Then check that:
            a) AllocatedSpace[18:19] (the next free slot index of the second slot) contains 0
            b) The second byte of every slot, except the first contains 0 (meaning the name length field is set to 0 for every empty slot) (the first slot may also be 0, but for different reasons so don't check it)
    */
    await runSetup();
    // As table will be allocated globally straight after setup, it will be located at the start of the heap
    let tableAddress = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
    await runInstructions(VarTable.create(0, Addresses.NullAddress), false, true);
    // Check a
    let checkResult = assertMemoryEqualToInt(0, tableAddress + 18, 2);
    if (checkResult !== true) return checkResult;
    // Check b
    let currentSlot = tableAddress + VarTable._headersLength + VarTable._entryLength + 1;
    for (let i = 0; i < Math.floor((runtime_options.VariableTableSize - (VarTable._headersLength + VarTable._entryLength + 4)) / VarTable._entryLength); i++){
        checkResult = assertMemoryEqualToInt(0, currentSlot, 1);
        if (checkResult !== true) return checkResult;
        checkResult + VarTable._entryLength;
    }
    return true;
}
// Test3- Create table, and check parent entry created correctly
async function test_VarTable_createCheckParentEntry(){
    /*
        Allocate space for and create a new global variable table
        Then check that:
            a) AllocatedSpace[6] contains the type tag for a variable table entry
            b) AllocatedSpace[7] contains 0 (the name length, 0 as parent entry has no name)
            c) AllocatedSpace[12:15] contains the null address (as global variable tables have no parent table)
    */
    await runSetup();
    // As table will be allocated globally straight after setup, it will be located at the start of the heap
    let tableAddress = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
    await runInstructions(VarTable.create(0, Addresses.NullAddress), false, true);
    // Check a
    let checkResult = assertMemoryEqualToInt(type_tags.var_table_entry, tableAddress + 6, 1);
    if (checkResult !== true) return checkResult;
    // Check b
    checkResult = assertMemoryEqualToInt(0, tableAddress + 7, 1);
    if (checkResult !== true) return checkResult;
    // Check c
    return assertMemoryEqualToInt(Addresses.NullAddress, tableAddress + 12, 4);
}
