/*
    Defines instructions for common procedures that will be used repeatedly (e.g. LOAD, ALLOCATE)
    These are simply be added to the start of the program, and then accessed using GTO when necessary
    This is far more memory efficient than having a copy of the same procedure whenever it is used

    When done, they jump to the address in psAddr
*/

var ProcedureOffset;  // The location in memory of the procedures

/*
    Procedure for allocating memory
    The details about how much to allocate and where from are provided in the top entry on EvalStack:
        - EvalTop[0] = Amount of space needed (as a power of 2)
        - EvalTop[1] = The type tag of the object that the allocation is for (used to know whether the int/float pool can be used)
        - EvalTop[2] = Set to 1 to force the space to be allocated globally (i.e. on the heap or int/float pool).  If the DeclareGlobal flag is set it will be allocated globally regardless of whether this is set

    Upon completion, the first address of the newly allocated space is placed in the first 4 bytes of EvalTop
*/
var AllocationProc = [
    "#allocate AND 0"  // Clear accumulator
    // First, copy the top item on the Eval stack into ps0 and ps1 (as items are 5 bytes each, it will take the first byte of ps1) as it contains the details of the allocation request
]
.concat(copy(Addresses.EvalTop, Addresses.psAddr, 4));  // Copy pointer to top item into psAddr
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps0, 5, ProcedureOffset + calculateInstructionsLength(AllocationProc)), // Copy item itself into ps0 and ps1
    [
        // Decide whether to allocate on stack or global heap
        "AND 0",
        `ADD A ${Addresses.ps0 + 2}`,  // If the third byte of details is not 0, then it should be allocated globally regardless of current scope
        "BIZ #allocate_check_scope",  // Third byte is 0, so check if current scope is global
        "OUT #allocate_global",
        "#allocate_check_scope AND 0"
    ],
    // Check if current scope is global by checking if scope pointer is equal to global area start address
    checkEqual(Addresses.ScopePointer, Addresses.GlobalArea, "#allocate_global", "#allocate_local", false, true),
    [
        // Allocate on the global heap
        // First check if the type 32 or 33 (int or float), as this will allow the int/float pool to be used
        `#allocate_global RED ${Addresses.ps0 + 1}`,  // Second byte of details contains the type
        "SUB 32",
        "BIZ #allocate_check_pool_full",
        "ADD 32", // Simply re-adding 32 uses fewer CPU cycles than re-fetching the value from memory
        "SUB 33",
        "BIZ #allocate_check_pool_full",
        
        // Can't use the pool so allocate from heap
        "#allocate_from_global_heap",

        // Int or float so allocate from int/float pool (if isn't full)
        "#allocate_check_pool_full AND 0"
    ],
    // We know the pool is full if the PoolFreePointer points to the address following the end of the pool
    checkEqual(Addresses.PoolFreePointer, Addresses.IntFloatPool + runtime_options.IntFloatPoolSize, "#allocate_from_global_heap", "#allocate_from_pool", false, true),
    [
        // Allocate the first free space in the pool (it is pointed to by PoolFreePointer)
        "#allocate_from_pool AND 0",
    ],
    copy(Addresses.PoolFreePointer, Addresses.ps3, 4),  // Store allocated address in ps3
    // Update PoolFreePointer to point to next free space in pool (or end of pool if no more free space)
    // The space we just allocated might contain a pointer to another free space, if so set PoolFreePointer to that space.  Otherwise increment PoolFreePointer by 5 to point to next free space (or end of pool if full)
    copy(Addresses.PoolFreePointer, Addresses.psAddr, 4),
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps2, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // Whatever was inside the space we allocated is now in ps2
    checkZero(Addresses.ps2, 4, "#allocate_update_pool_pointer_contiguous", "#allocate_update_pool_pointer_pointer"),
    [
        // The space does not contain another pointer, so increment PoolFreePointer
        `#allocate_update_pool_pointer_contiguous RED ${Addresses.PoolFreePointer + 3}`,
        "ADD 5",
        `WRT ${Addresses.PoolFreePointer + 3}`,
        "BIC #allocate_increment_pool_ptr_c1",
        "GTO #allocate_finish",
        // Handle carry
        `#allocate_increment_pool_ptr_c1 RED ${Addresses.PoolFreePointer + 2}`,
        "ADD 1",
        `WRT ${Addresses.PoolFreePointer + 2}`,
        "BIC #allocate_increment_pool_ptr_c2",
        "GTO #allocate_finish",
        `#allocate_increment_pool_ptr_c1 RED ${Addresses.PoolFreePointer + 1}`,
        "ADD 1",
        `WRT ${Addresses.PoolFreePointer + 1}`,
        "BIC #allocate_increment_pool_ptr_c3",
        "GTO #allocate_finish",
        `#allocate_increment_pool_ptr_c3 RED ${Addresses.PoolFreePointer}`,
        "ADD 1",
        `WRT ${Addresses.PoolFreePointer}`,
        "GTO #allocate_finish",

        // The space does contain another pointer, so simply load that into PoolFreePointer
        "#allocate_update_pool_pointer_contiguous AND 0",
    ],
    copy(Addresses.ps2, Addresses.PoolFreePointer, 4),
    "GTO #allocate_finish"
);
