/*
    Automated tests for testing structures
*/
var tests_structures = [];
/*
    Tests for evaluation stack
*/
let tests_EvalStack = [test_EvalStack_addLayerWhenEmpty, test_EvalStack_addLayerWhenPartiallyFull, test_EvalStack_addLayerWhenFull, test_EvalStack_removeLayerWhenNotEmpty, test_EvalStack_removeLayerWhenEmpty, test_EvalStack_writeLiteralToTopLayer, test_EvalStack_copyToTopLayer, test_EvalStack_writeLiteralToNewLayer, test_EvalStack_copyToNewLayer];
tests_structures = tests_structures.concat(tests_EvalStack);
// Setup subprocedures that need to be run before these tests can work
let evalStackTests_neededSetup = [setupReservedArea];
// Test1- Add a new layer when there are no layers on the stack
async function test_EvalStack_addLayerWhenEmpty(){
    /* Add a new layer, then check that:
        a) EvalSlotsUsed contains 1
        b) EvalTop has been incremented by 5
    */
   await runSetup(evalStackTests_neededSetup);
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
   await runSetup(evalStackTests_neededSetup);
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
   await runSetup(evalStackTests_neededSetup);
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
   await runSetup(evalStackTests_neededSetup);
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
   await runSetup(evalStackTests_neededSetup);
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
    await runSetup(evalStackTests_neededSetup);
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
    await runSetup(evalStackTests_neededSetup);
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
   await runSetup(evalStackTests_neededSetup);
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
let tests_VarTable = [test_VarTable_createCheckCorrectFormat, test_VarTable_createCheckSlotsClear, test_VarTable_createCheckParentEntry, test_VarTable_globalAddEntryWhenNoExistingEntriesExceptParent, test_VarTable_localAddEntryWhenNoExistingEntriesExceptParent, test_VarTable_addEntryWhenPartiallyFull, test_VarTable_globalCreateExpansionWhenNoneExist, test_VarTable_localCreateExpansionWhenNoneExist, test_VarTable_createExpansionWhenSomeExist, test_VarTable_addEntryWhenCompletelyFull, test_VarTable_addEntryInDeallocatedSlotInParent, test_VarTable_addEntryInDeallocatedSlotInExpansion];
tests_structures = tests_structures.concat(tests_VarTable);
// The setup subprocedures that need to be run before these tests can work
let varTableTestsCreation_neededSetup = [setupReservedArea, setupGlobalHeap, setupConstantProcedures];
// Test1- Create table, and check it is is in the correct format (has all the correct headers)
async function test_VarTable_createCheckCorrectFormat(){
    /*
        Allocate space for and create a new global variable table
        Then check that:
            a) The first byte of the allocated space contains the type tag for variable tables
            b) AllocatedSpace[1:2] (0 indexed) contains 1 (the number of entries in the table, should be 1 as the "parent" entry should have been added)
            c) AllocatedSpace[3] contains 0 (the number of expansion tables, 0 as there aren't any yet)
            d) AllocatedSpace[4:7] contains the address of the second entry (the address of the next free slot in the table, should be 2nd slot as the first space is already taken by the "parent" entry)
            e) The second byte of the unused space between the last slot and "next expansion pointer" footer does not contain 0
    */
   await runSetup(varTableTestsCreation_neededSetup);
   // As table will be allocated globally straight after setup, it will be located at the start of the heap
   let tableAddress = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
   await runInstructions(VarTable.create(testsInstructionsStart, Addresses.NullAddress), false, true);
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
   checkResult = assertMemoryEqualToInt(tableAddress + VarTable._parentHeadersLength + VarTable._entryLength, tableAddress + 4, 4);
   if (checkResult !== true) return checkResult;
   // Check e
   return assertMemoryNotEqualToInt(0, tableAddress + VarTable._parentHeadersLength + (VarTable._entryLength * VarTable._parentTotalSlots) + 1, 1);
}
// Test2- Create table, and check all of the empty slots have been cleared
async function test_VarTable_createCheckSlotsClear(){
    /*
        Allocate space for and create a new global variable table
        Then check that:
            a) AllocatedSpace[18:19] (the next free slot index of the second slot) contains 0
            b) The second byte of every slot, except the first contains 0 (meaning the name length field is set to 0 for every empty slot) (the first slot may also be 0, but for different reasons so don't check it)
    */
    await runSetup(varTableTestsCreation_neededSetup);
    // As table will be allocated globally straight after setup, it will be located at the start of the heap
    let tableAddress = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
    await runInstructions(VarTable.create(testsInstructionsStart, Addresses.NullAddress), false, true);
    // Check a
    let checkResult = assertMemoryEqualToInt(0, tableAddress + 18, 2);
    if (checkResult !== true) return checkResult;
    // Check b
    let currentSlot = tableAddress + VarTable._headersLength + VarTable._entryLength + 1;
    for (let i = 0; i < Math.floor((runtime_options.VariableTableSize - (VarTable._headersLength + VarTable._entryLength + 4)) / VarTable._entryLength); i++){
        checkResult = assertMemoryEqualToInt(0, currentSlot, 1);
        if (checkResult !== true) return checkResult;
        currentSlot + VarTable._entryLength;
    }
    return true;
}
// Test3- Create table, and check parent entry created correctly
async function test_VarTable_createCheckParentEntry(){
    /*
        Allocate space for and create a new global variable table
        Then check that:
            a) AllocatedSpace[8] contains the type tag for a variable table entry
            b) AllocatedSpace[9] contains 0 (the name length, 0 as parent entry has no name)
            c) AllocatedSpace[14:17] contains the null address (as global variable tables have no parent table)
    */
    await runSetup(varTableTestsCreation_neededSetup);
    // As table will be allocated globally straight after setup, it will be located at the start of the heap
    let tableAddress = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
    await runInstructions(VarTable.create(testsInstructionsStart, Addresses.NullAddress), false, true);
    // Check a
    let checkResult = assertMemoryEqualToInt(type_tags.var_table_entry, tableAddress + 8, 1);
    if (checkResult !== true) return checkResult;
    // Check b
    checkResult = assertMemoryEqualToInt(0, tableAddress + 9, 1);
    if (checkResult !== true) return checkResult;
    // Check c
    return assertMemoryEqualToInt(Addresses.NullAddress, tableAddress + 14, 4);
}
let varTableTestsAddEntry_neededSetup = [setupReservedArea, setupGlobalHeap, setupConstantProcedures, setupGlobalVarTable];
// Test4- Add entry to variable table with no existing entries (except the parent one).  Set forceGlobal flag
async function test_VarTable_globalAddEntryWhenNoExistingEntriesExceptParent(){
    /*
        Use a fake name address and name length and add entry to table. Set forceGlobal flag.  Then check that:
            a) EvalTop[0:3] contains the address of the second slot in the parent VarTable
            b) The specified slot has the following data:
                - slot[0] = type tag for VarTable entries
                - slot[1] = Fake name length
                - slot[2:5] = Fake name address
                - slot[6:9] = The null address
            c) VarTable[1:2] (the "number of entries" header) contains 2
            d) VarTable[3] (the "number of expansions" header) contains 0
            e) VarTable[4:7] ("next free slot" header) contains address of the third slot
            f) The 2nd byte ("name length" field) of the third slot contains 0
    */
    let mockNameAddress = runtime_options.MemorySize - 1;  // Can use any valid address for this, so just use last address in memory
    let mockNameLength = 11;  // 11 is arbitrary
    await runSetup(varTableTestsAddEntry_neededSetup);
    let varTable = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.VarTablePointer, 4);
    // Construct Eval args
    writeToEvalTopLayer(generateByteSequence([1], 1), 1);  // write forceGlobal flag
    pushLayerToEvalStack(generateByteSequence([mockNameLength, mockNameAddress, "<", "<", "<"], 5));  // Write nameLength and address to new layer of Eval Stack
    await runInstructions(VarTable.addEntry(testsInstructionsStart), false, true);
    let evalTop = readMemoryAsInt(Addresses.EvalTop, 4);
    // Check a
    let checkResult = assertMemoryEqualToInt(varTable + VarTable._parentHeadersLength + VarTable._entryLength, evalTop, 4);
    if (checkResult !== true) return checkResult;
    // Check b
    let newEntry = readMemoryAsInt(evalTop, 4);
    checkResult = assertMemoryEqualToInt(type_tags.var_table_entry, newEntry, 1);
    if (checkResult !== true) return checkResult;
    checkResult = assertMemoryEqualToInt(mockNameLength, newEntry + 1, 1);
    if (checkResult !== true) return checkResult;
    checkResult = assertMemoryEqualToInt(mockNameAddress, newEntry + 2, 4);
    if (checkResult !== true) return checkResult;
    checkResult = assertMemoryEqualToInt(Addresses.NullAddress, newEntry + 6, 4);
    if (checkResult !== true) return checkResult;
    // Check c
    checkResult = assertMemoryEqualToInt(2, varTable + 1, 2);
    if (checkResult !== true) return checkResult;
    // Check d
    checkResult = assertMemoryEqualToInt(0, varTable + 3, 1);
    if (checkResult !== true) return checkResult;
    // Check e
    let thirdSlot = newEntry + VarTable._entryLength;
    checkResult = assertMemoryEqualToInt(thirdSlot, varTable + 4, 4);
    if (checkResult !== true) return checkResult;
    // Check f
    return assertMemoryEqualToInt(0, thirdSlot + 1, 1);
}
// Test5- Add entry to variable table with no existing entries (except the parent one)
async function test_VarTable_localAddEntryWhenNoExistingEntriesExceptParent(){
    /*
        Use a fake name address and name length and add entry to table.  Then check that:
            a) EvalTop[0:3] contains the address of the second slot in the parent VarTable
            b) The specified slot has the following data:
                - slot[0] = type tag for VarTable entries
                - slot[1] = Fake name length
                - slot[2:5] = Fake name address
                - slot[6:9] = The null address
            c) VarTable[1:2] (the "number of entries" header) contains 2
            d) VarTable[3] (the "number of expansions" header) contains 0
            e) VarTable[4:7] ("next free slot" header) contains address of the third slot
            f) The 2nd byte ("name length" field) of the third slot contains 0
    */
    return "NOT IMPLEMENTED";
}
// Test6- Add entry to partially full variable table
async function test_VarTable_addEntryWhenPartiallyFull(){
    /*
        Add 50 entries to the table (50 is arbitrary).  Then add another.
        Then check that:
            a) EvalTop[0:3] contains the address of the 52nd slot in the table
            b) VarTable[1:2] (the "number of entries" header) contains 52
    */
    await runSetup(varTableTestsAddEntry_neededSetup);
    // Add 50 entries
    await testHelper_addMultipleEntriesToVarTable(50, false, testsInstructionsStart);
    // Add another entry
    writeToEvalTopLayer([0], 1);
    pushLayerToEvalStack(generateByteSequence([5, 5, "<", "<", "<"], 5));  // These values are arbitrary
    await runInstructions(VarTable.addEntry(testsInstructionsStart), false, true);
    // Check a
    let evalTop = readMemoryAsInt(Addresses.EvalTop, 4);
    let varTable = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.VarTablePointer, 4);
    let checkResult = assertMemoryEqualToInt(varTable + (VarTable._parentHeadersLength) + (VarTable._entryLength * 51), evalTop, 4);
    if (checkResult !== true) return checkResult;
    return assertMemoryEqualToInt(52, varTable + 1, 2);
}
// Test7- Add entry when VarTable is full (so an expansion should be created).  Set forceGlobal flag
async function test_VarTable_globalCreateExpansionWhenNoneExist(){
    /*
        Add ${VarTable._parentTotalSlots - 1} entries with forceGlobal flag set.  Then add another
        Then check that:
            a) ParentVarTable[3] (the "number of expansions" header) contains 1
            b) The last 4 bytes of parent table contains address of an expansion table (use type tag to verify this)
            c) EvalTop[0:3] contains the address of the first slot in the expansion table
            d) The 1st byte ("type tag" field) of the first slot in the expansion contains the type tag for VarTable entries
            e) ParentVarTable[4:7] ("next free slot" header) contains the address of the second slot in the expansion table
            f) The 2nd byte ("name length field") of the second slot in the expansion contains 0
            g) ParentVarTable[1:2] ("number of entries" header) contains ${VarTable._parentTotalSlots + 1}
            h) The second byte after the last slot in the expansion table does not contain 0
    */
    await runSetup(varTableTestsAddEntry_neededSetup);
    let parentVarTable = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.VarTablePointer, 4);
    await testHelper_addMultipleEntriesToVarTable(VarTable._expansionTotalSlots - 1, true, testsInstructionsStart);
    writeToEvalTopLayer([1], 1);
    pushLayerToEvalStack(generateByteSequence([5, 5, "<", "<", "<"], 5));  // These values are arbitrary
    await runInstructions(VarTable.addEntry(testsInstructionsStart), false, true);
    // Check a
    let checkResult = assertMemoryEqualToInt(1, parentVarTable + 3, 1);
    if (checkResult !== true) return checkResult;
    // Check b
    let expansionVarTable = readMemoryAsInt(parentVarTable + runtime_options.VariableTableSize - 4, 4);
    checkResult = assertMemoryEqualToInt(type_tags.expansion_var_table, expansionVarTable, 1);
    if (checkResult !== true) return checkResult;
    // Check c
    let evalTop = readMemoryAsInt(Addresses.EvalTop, 4);
    let expansionFirstSlot = expansionVarTable + VarTable._expansionHeadersLength;
    checkResult = assertMemoryEqualToInt(expansionFirstSlot, evalTop, 4);
    if (checkResult !== true) return checkResult;
    // Check d
    checkResult = assertMemoryEqualToInt(type_tags.var_table_entry, expansionFirstSlot, 1);
    if (checkResult !== true) return checkResult;
    // Check e
    let expansionSecondSlot = expansionFirstSlot + VarTable._entryLength;
    checkResult = assertMemoryEqualToInt(expansionSecondSlot, parentVarTable + 4, 4);
    if (checkResult !== true) return checkResult;
    // Check f
    checkResult = assertMemoryEqualToInt(0, expansionSecondSlot + 1, 1);
    if (checkResult !== true) return checkResult;
    // Check g
    checkResult = assertMemoryEqualToInt(VarTable._parentTotalSlots + 1, parentVarTable + 1, 2);
    if (checkResult !== true) return checkResult;
    // Check h
    return assertMemoryNotEqualToInt(0, expansionVarTable + VarTable._expansionHeadersLength + (VarTable._expansionTotalSlots * VarTable._entryLength) + 1, 1);
}
// Test8- Add entry when VarTable is full (so an expansion should be created)
async function test_VarTable_localCreateExpansionWhenNoneExist(){
    /*
        Add ${VarTable._parentTotalSlots - 1} entries.  Then add another
        Then check that:
            a) ParentVarTable[3] (the "number of expansions" header) contains 1
            b) The last 4 bytes of parent table contains address of an expansion table (use type tag to verify this)
            c) EvalTop[0:3] contains the address of the first slot in the expansion table
            d) The 1st byte ("type tag" field) of the first slot in the expansion contains the type tag for VarTable entries
            e) ParentVarTable[4:7] ("next free slot" header) contains the address of the second slot in the expansion table
            f) The 2nd byte ("name length field") of the second slot in the expansion contains 0
            g) ParentVarTable[1:2] ("number of entries" header) contains ${VarTable._parentTotalSlots + 1}
            h) The second byte after the last slot in the expansion table does not contain 0
    */
    return "NOT IMPLEMENTED";
}
// Test9- Add entry when multiple expansions already exist and are full (so another expansion should be created)
async function test_VarTable_createExpansionWhenSomeExist(){
    /*
        Fill the parent table, then fill an expansion table.  Then add another entry
        The check that:
            a) ParentVarTable[3] (the "number of expansions" header) contains 2
            b) The last 4 bytes of the parent table still contains the address of the first expansion table (not the new one)
            c) The last 4 bytes of the first expansion table contains the address of another expansion table (use type tag to verify this)
            d) EvalTop[0:3] contains the address of the first slot in the new expansion
            e) ParentVarTable[4:7] ("next free slot" header points to the 2nd slot in the new expansion)
    */
    await runSetup(varTableTestsAddEntry_neededSetup);
    let parentVarTable = readMemoryAsInt(Addresses.EvalTop, 4);
    await testHelper_addMultipleEntriesToVarTable((VarTable._parentTotalSlots - 1) + VarTable._expansionTotalSlots, false, testsInstructionsStart);
    writeToEvalTopLayer([0], 1);
    pushLayerToEvalStack(generateByteSequence([5, 5, "<", "<", "<"], 5));  // These values are arbitrary
    let firstExpansion = readMemoryAsInt(parentVarTable + runtime_options.VariableTableSize - 4, 4);
    await runInstructions(VarTable.addEntry(testsInstructionsStart), false, true);
    // Check a
    let checkResult = assertMemoryEqualToInt(2, parentVarTable + 3, 1);
    if (checkResult !== true) return checkResult;
    // Check b
    checkResult = assertMemoryEqualToInt(firstExpansion, parentVarTable + runtime_options.VariableTableSize - 4, 4);
    if (checkResult !== true) return checkResult;
    // Check c
    let secondExpansion = readMemoryAsInt(firstExpansion + runtime_options.VariableTableSize - 4, 4);
    checkResult = assertMemoryEqualToInt(type_tags.expansion_var_table, secondExpansion, 1);
    if (checkResult !== true) return checkResult;
    // Check d
    let evalTop = readMemoryAsInt(Addresses.EvalTop, 4);
    checkResult = assertMemoryEqualToInt(secondExpansion + VarTable._expansionHeadersLength, evalTop, 4);
    if (checkResult !== true) return checkResult;
    // Check e
    return assertMemoryEqualToInt(secondExpansion + VarTable._expansionHeadersLength + VarTable._entryLength, parentVarTable + 4, 4);
}
// Test10- Try to add entry when the maximum number of expansions has been reached, and all are full
async function test_VarTable_addEntryWhenCompletelyFull(){
    // TODO Need to implement this when error handling is set up
    return "NOT IMPLEMENTED";
}
// Test11- Create entry after deallocating one
async function test_VarTable_addEntryInDeallocatedSlotInParent(){
    /*
        Add 50 entries (50 is arbitrary) and then deallocate one of them (not the first or last one).  Then add another entry and check that it has been created in the deallocated space
    */
    // TODO Need to implement this when deallocation is set up for VarTables
    return "NOT IMPLEMENTED";
}
// Test12- Create entry after deallocating one in expansion table
async function test_VarTable_addEntryInDeallocatedSlotInExpansion(){
    /*
        Fill the parent table, and add 50 to the expansion table (50 is arbitrary) and then deallocate one of them (not the first or last one).
        Then add another entry and check that it has been created in the deallocated space
    */
    // TODO Need to implement this when deallocation is set up for VarTables
    return "NOT IMPLEMENTED";
}

/*
    Tests for name pools
*/
let tests_NamePool = [];
let tests_NamePool_Parent = [test_NamePool_createCheckCorrectFormat, test_NamePool_createCheckFirstChunkPointerToNextFreeClear];
tests_NamePool = tests_NamePool.concat(tests_NamePool_Parent);
// The setup subprocedures that must be run before these tests can work
let namePoolTests_neededSetup = [setupReservedArea, setupGlobalHeap, setupConstantProcedures];

// Test1- Create name pool, and check headers are correct
async function test_NamePool_createCheckCorrectFormat(){
    /*
        Allocate space for and create a new name pool
        Then check that:
            a) AllocatedSpace[0] contains the type tag for name pools
            b) AllocatedSpace[1:4] contains the address of AllocatedSpace[7] (the start of the first free chunk)
            c) AllocatedSpace[5] contains the maximum number of blocks in a pool (This field should contain the number of blocks in the first free chunk. As there is only one free chunk and no blocks have been used, this will be the total number of blocks in the pool)
            d) AllocatedSpace[6] contains 0 (the number of expansion pools, 0 as there are none)
    */
   await runSetup(namePoolTests_neededSetup);
   // As pool will be allocated globally straight after setup, it will be located at the start of the heap
   let poolAddress = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
   await runInstructions(NamePool.create(testsInstructionsStart), false, true);
   // Check a
   let checkResult = assertMemoryEqualToInt(type_tags.name_pool, poolAddress, 1);
   if (checkResult !== true) return checkResult;
   // Check b
   checkResult = assertMemoryEqualToInt(poolAddress + 7, poolAddress + 1, 4);
   if (checkResult !== true) return checkResult;
   // Check c
   checkResult = assertMemoryEqualToInt(NamePool._parentTotalBlocks, poolAddress + 5, 1);
   if (checkResult !== true) return checkResult;
   // Check d
   return assertMemoryEqualToInt(0, poolAddress + 6, 1);
}
// Test2- Create name pool, and check details of next free chunk in first free chunk contain 0
async function test_NamePool_createCheckFirstChunkPointerToNextFreeClear(){
    /*
        Allocate space for and create a new name pool
        Then check that:
            a) AllocatedSpace[7:10] contains 0 (the pointer to the next free chunk, 0 as there isn't another free chunk)
            b) AllocatedSpace[11] contains 0 (the number of blocks in the next free chunk, 0 as there isn't another free chunk)
    */
   await runSetup(namePoolTests_neededSetup);
   // As pool will be allocated globally straight after setup, it will be located at the start of the heap
   let poolAddress = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.HeapStartPointer, 4);
   await runInstructions(NamePool.create(testsInstructionsStart), false, true);
   // Check a
   let checkResult = assertMemoryEqualToInt(0, poolAddress + 7, 4);
   if (checkResult !== true) return checkResult;
   // Check b
   return assertMemoryEqualToInt(0, poolAddress + 11, 1);
}

// Tests for expansion pools
let tests_NamePool_Expansion = [test_NamePool_ExpansionCreateGlobalWhenNoneAlreadyExist, test_NamePool_ExpansionCreateLocalWhenNoneAlreadyExist, test_NamePool_ExpansionCreateGlobalWhenSomeAlreadyExist, test_NamePool_ExpansionCreateLocalWhenSomeAlreadyExist, test_NamePool_ExpansionCreateGlobalWhenLimitReached, test_NamePool_ExpansionCreateLocalWhenLimitReached];
tests_NamePool = tests_NamePool.concat(tests_NamePool_Expansion);
tests_structures = tests_structures.concat(tests_NamePool);
let namePoolExpansionTests_neededSetup = [setupReservedArea, setupGlobalHeap, setupConstantProcedures, setupGlobalNamePool]
// Test3- Create expansion pool in global scope when there are no existing expansion pools
async function test_NamePool_ExpansionCreateGlobalWhenNoneAlreadyExist(){
    /*
        Create a new expansion name pool, with the forceGlobal flag set
        Then check that:
            a) The pool has the correct format (type tag in first byte)
            b) The parent pool's "number of expansions" header contains 1
            c) The parent pool's pointer to the next expansion (in the last 4 bytes) points to the new pool
            d) The "next free space" header in the parent pool points to the second byte of the new pool
            e) The "next free space size" header in the parent pool contains ${NamePool._expansionTotalBlocks}
            f) the 2nd - 5th bytes of the new pool (i.e. the "next chunk" pointer of the only chunk in the new pool) contains the same value as the parent pool's "next free chunk" header did before the expansion was created
            g) The 6th byte (i.e. the "next chunk size" field of the only chunk in the new pool) contains the same value as the parent pool's "next free chunk size" header did before the expansion was created
    */
    await runSetup(namePoolExpansionTests_neededSetup);
    // Record the values from the parent pool's "next chunk" details headers
    let parentPool = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.NamePoolPointer, 4);
    let oldFirstFreeChunkPtr = readMemoryAsInt(parentPool + 1, 4);
    let oldFirstFreeChunkSize = readMemoryAsInt(parentPool + 5, 1);
    // Create a new expansion name pool
    await runInstructions(NamePool.createExpansion(testsInstructionsStart, true), false, true);
    // Get address of the new pool (should have been left on EvalTop)
    let expansionPool = readMemoryAsInt(readMemoryAsInt(Addresses.EvalTop, 4), 4);
    // Check a
    let checkResult = assertMemoryEqualToInt(type_tags.expansion_name_pool, expansionPool, 1);
    if (checkResult !== true) return checkResult;
    // Check b
    checkResult = assertMemoryEqualToInt(1, parentPool + 6, 1);
    if (checkResult !== true) return checkResult;
    // Check c
    checkResult = assertMemoryEqualToInt(expansionPool, parentPool + (runtime_options["NamePoolSize"] - 4), 4);
    if (checkResult !== true) return checkResult;
    // Check d
    checkResult = assertMemoryEqualToInt(expansionPool + 1, parentPool + 1, 4);
    if (checkResult !== true) return checkResult;
    // Check e
    checkResult = assertMemoryEqualToInt(NamePool._expansionTotalBlocks, parentPool + 5, 1);
    if (checkResult !== true) return checkResult;
    // Check f
    checkResult = assertMemoryEqualToInt(oldFirstFreeChunkPtr, expansionPool + 1, 4);
    if (checkResult !== true) return checkResult;
    // Check g
    return assertMemoryEqualToInt(oldFirstFreeChunkSize, expansionPool + 5, 1);  
}
// Test4- Create expansion pool in local scope when there are no existing expansion pools
async function test_NamePool_ExpansionCreateLocalWhenNoneAlreadyExist(){
    /*
        Create a new expansion name pool, WITHOUT the forceGlobal flag set (global scope will still be used, but createExpansion won't know this, so the procedure will be the same as for local scope)
        Then check that:
            a) The pool has the correct format (type tag in first byte)
            b) The parent pool's "number of expansions" header contains 1
            c) The parent pool's pointer to the next expansion (in the last 4 bytes) points to the new pool
            d) The "next free space" header in the parent pool points to the second byte of the new pool
            e) The "next free space size" header in the parent pool contains ${NamePool._expansionTotalBlocks}
            f) the 2nd - 5th bytes of the new pool (i.e. the "next chunk" pointer of the only chunk in the new pool) contains the same value as the parent pool's "next free chunk" header did before the expansion was created
            g) The 6th byte (i.e. the "next chunk size" field of the only chunk in the new pool) contains the same value as the parent pool's "next free chunk size" header did before the expansion was created
    */
    await runSetup(namePoolExpansionTests_neededSetup);
    // Record the values from the parent pool's "next chunk" details headers
    let parentPool = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.NamePoolPointer, 4);
    let oldFirstFreeChunkPtr = readMemoryAsInt(parentPool + 1, 4);
    let oldFirstFreeChunkSize = readMemoryAsInt(parentPool + 5, 1);
    // Create a new expansion name pool
    await runInstructions(NamePool.createExpansion(testsInstructionsStart, false), false, true);
    // Get address of the new pool (should have been left on EvalTop)
    let expansionPool = readMemoryAsInt(readMemoryAsInt(Addresses.EvalTop, 4), 4);
    // Check a
    let checkResult = assertMemoryEqualToInt(type_tags.expansion_name_pool, expansionPool, 1);
    if (checkResult !== true) return checkResult;
    // Check b
    checkResult = assertMemoryEqualToInt(1, parentPool + 6, 1);
    if (checkResult !== true) return checkResult;
    // Check c
    checkResult = assertMemoryEqualToInt(expansionPool, parentPool + (runtime_options["NamePoolSize"] - 4), 4);
    if (checkResult !== true) return checkResult;
    // Check d
    checkResult = assertMemoryEqualToInt(expansionPool + 1, parentPool + 1, 4);
    if (checkResult !== true) return checkResult;
    // Check e
    checkResult = assertMemoryEqualToInt(NamePool._expansionTotalBlocks, parentPool + 5, 1);
    if (checkResult !== true) return checkResult;
    // Check f
    checkResult = assertMemoryEqualToInt(oldFirstFreeChunkPtr, expansionPool + 1, 4);
    if (checkResult !== true) return checkResult;
    // Check g
    return assertMemoryEqualToInt(oldFirstFreeChunkSize, expansionPool + 5, 1);  
}
// Test5- Create expansion pool in global scope when there are already 254 expansion pools
async function test_NamePool_ExpansionCreateGlobalWhenSomeAlreadyExist(){
    /*
        Manually create 254 expansion pools, then use NamePool.createExpansion with forceGlobal set to create another one.
        Then check that:
            a) The parent pool's "number of expansions" header contains 255
            b) The "next expansion" footer in the 254th expansion pool points to the new pool
                - This should be checked by following the "next expansion" footers of each pool, which should eventually (after 255 pools) lead to the new pool
                - Doing it this way rather than just going straight to 254th allows us to also check that the other footers were not incorrectly modified
    */
    await runSetup(namePoolExpansionTests_neededSetup);
    let parentPool = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.NamePoolPointer, 4);
    // Manually create the 254 expansions
    // First allocate the space for them
    writeIntToMemory(Math.ceil(Math.log2(runtime_options.NamePoolSize * 254)), readMemoryAsInt(Addresses.EvalTop, 4), 1);
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(["GTO #allocate"]), Addresses.psReturnAddr, 4);
    await runInstructions(["GTO #allocate"], false, true);
    let existingTablesSpace = readMemoryAsInt(readMemoryAsInt(Addresses.EvalTop, 4), 4);
    // Create the pools
    let previousPoolsFooter = parentPool + (runtime_options.NamePoolSize - 4);
    for (let i = 0; i < 254; i++){
        let currentPoolSpace = existingTablesSpace + (i * runtime_options.NamePoolSize);
        // Write pool's type header (not really needed, but might make debugging this test easier if we can see where each pool starts and ends)
        writeIntToMemory(currentPoolSpace, type_tags.expansion_name_pool, 1);
        // Write this pool's address to the "next expansion" footer of the previous pool
        writeIntToMemory(currentPoolSpace, previousPoolsFooter, 4);
        // Increment the "number of expansions" header in the parent pool
        writeIntToMemory(readMemoryAsInt(parentPool + 6, 1) + 1, parentPool + 6, 1);
        previousPoolsFooter = currentPoolSpace + (runtime_options.NamePoolSize - 4);
    }
    // Create the new expansion pool
    await runInstructions(NamePool.createExpansion(testsInstructionsStart, true), false, true);
    let expansionPool = readMemoryAsInt(readMemoryAsInt(Addresses.EvalTop, 4), 4);
    // Check a
    let checkResult = assertMemoryEqualToInt(255, parentPool + 6, 1);
    if (checkResult !== true) return checkResult;
    // Check b
    let currentPool = parentPool;
    for (let i = 0; i < 255; i++){
        currentPool = readMemoryAsInt(currentPool + (runtime_options.NamePoolSize - 4), 4);
    }
    return assertEqual(expansionPool, currentPool);
}
// Test6- Create expansion pool in local scope when there are already 254 expansion pools
async function test_NamePool_ExpansionCreateLocalWhenSomeAlreadyExist(){
    /*
        Manually create 254 expansion pools, then use NamePool.createExpansion to create another one.  By doing this with forceGlobal set to false, we will still be using the global scope but createExpansion won't know this, so the procedure will be the same as for local scopes
        Then check that:
            a) The parent pool's "number of expansions" header contains 255
            b) The "next expansion" footer in the 254th expansion pool points to the new pool
                - This should be checked by following the "next expansion" footers of each pool, which should eventually (after 255 pools) lead to the new pool
                - Doing it this way rather than just going straight to 254th allows us to also check that the other footers were not incorrectly modified
    */
    await runSetup(namePoolExpansionTests_neededSetup);
    let parentPool = readMemoryAsInt(Addresses.GlobalArea + Offsets.frame.NamePoolPointer, 4);
    // Manually create the 254 expansions
    // First allocate the space for them
    writeIntToMemory(Math.ceil(Math.log2(runtime_options.NamePoolSize * 254)), readMemoryAsInt(Addresses.EvalTop, 4), 1);
    writeIntToMemory(testsInstructionsStart + calculateInstructionsLength(["GTO #allocate"]), Addresses.psReturnAddr, 4);
    await runInstructions(["GTO #allocate"], false, true);
    let existingTablesSpace = readMemoryAsInt(readMemoryAsInt(Addresses.EvalTop, 4), 4);
    // Create the pools
    let previousPoolsFooter = parentPool + (runtime_options.NamePoolSize - 4);
    for (let i = 0; i < 254; i++){
        let currentPoolSpace = existingTablesSpace + (i * runtime_options.NamePoolSize);
        // Write pool's type header (not really needed, but might make debugging this test easier if we can see where each pool starts and ends)
        writeIntToMemory(currentPoolSpace, type_tags.expansion_name_pool, 1);
        // Write this pool's address to the "next expansion" footer of the previous pool
        writeIntToMemory(currentPoolSpace, previousPoolsFooter, 4);
        // Increment the "number of expansions" header in the parent pool
        writeIntToMemory(readMemoryAsInt(parentPool + 6, 1) + 1, parentPool + 6, 1);
        previousPoolsFooter = currentPoolSpace + (runtime_options.NamePoolSize - 4);
    }
    // Create the new expansion pool
    await runInstructions(NamePool.createExpansion(testsInstructionsStart, false), false, true);
    let expansionPool = readMemoryAsInt(readMemoryAsInt(Addresses.EvalTop, 4), 4);
    // Check a
    let checkResult = assertMemoryEqualToInt(255, parentPool + 6, 1);
    if (checkResult !== true) return checkResult;
    // Check b
    let currentPool = parentPool;
    for (let i = 0; i < 255; i++){
        currentPool = readMemoryAsInt(currentPool + (runtime_options.NamePoolSize - 4), 4);
    }
    return assertEqual(expansionPool, currentPool);
}
// Test7- Try to create expansion pool in global scope when the expansion pool limit has been reached
async function test_NamePool_ExpansionCreateGlobalWhenLimitReached(){
    return "NOT IMPLEMENTED";
}
// Test8- Try to create expansion pool in local scope when the expansion pool limit has been reached
async function test_NamePool_ExpansionCreateLocalWhenLimitReached(){
    return "NOT IMPLEMENTED";
}

tests_all = tests_all.concat(tests_structures);