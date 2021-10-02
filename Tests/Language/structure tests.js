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
   await runInstructions(EvalStack.addLayer(0), false, true);
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
   await runInstructions(EvalStack.addLayer(0), false, true);
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
   await runInstructions(EvalStack.removeLayer(0), false, true);
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
   await runInstructions(EvalStack.removeLayer(0), false, true);
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
   await runInstructions(EvalStack.writeToTopLayer([5, 6, 7, 8, 9], 0), false, true);
   let checkResult;
   for (let i = 5; i < 10; i++){
        checkResult = assertMemoryEqualToInt(i, originalEvalTopAddr + 5, 1);
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
    await runInstructions(EvalStack.copyToTopLayer(Addresses.ps0, 0), false, true);
    let checkResult;
    for (let i = 5; i < 10; i++){
        checkResult = assertMemoryEqualToInt(i, originalEvalTopAddr + 5, 1);
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
    await runInstructions(EvalStack.pushLiteral([5, 6, 7, 8, 9], 0), false, true);
    let checkResult;
    for (let i = 5; i < 10; i++){
        checkResult = assertMemoryEqualToInt(i, originalEvalTopAddr + 5, 1);
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
   await runInstructions(EvalStack.copyToNewLayer(Addresses.ps7, 0), false, true);
   let checkResult;
    for (let i = 5; i < 10; i++){
        checkResult = assertMemoryEqualToInt(i, originalEvalTopAddr + 5, 1);
        if (checkResult !== true) return checkResult;
    }
    return true;
}