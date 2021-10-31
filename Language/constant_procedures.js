/*
    Defines instructions for common procedures that will be used repeatedly (e.g. LOAD, ALLOCATE)
    These are simply be added to the start of the program, and then accessed using GTO when necessary
    This is far more memory efficient than having a copy of the same procedure whenever it is used

    When done, they jump to the address in psReturnAddr
*/

function AddConstantProcedures(ProcedureOffset){
// Return the code for the procedures
// ProcedureOffset is the address in memory of the first instruction of the procedures
// When returning the procedures, we will add a GOTO instruction to skip over them as we don't actually want to run them during setup.  ProcedureOffset must include this instruction
ProcedureOffset += calculateInstructionsLength([`GTO ${ProcedureOffset}`]);

/*
    Procedure for allocating memory
    The details about how much to allocate and where from are provided in the top entry on EvalStack:
        - EvalTop[0] = Amount of space needed (as a power of 2)
        - EvalTop[1] = The type tag of the object that the allocation is for (used to know whether the int/float pool can be used)
        - EvalTop[2] = Set to 1 to force the space to be allocated globally (i.e. on the heap or int/float pool).

    Upon completion, the first address of the newly allocated space is placed in the first 4 bytes of EvalTop
*/

let chunkStart = Addresses.ps9;
let chunkEnd = Addresses.ps10;
let blockStart = Addresses.ps11;
let smallestFound = Addresses.ps12;
let smallestFoundPrevPointers = Addresses.ps13;  // The address of the chunk pointers that point to the chunk that contains the smallestFound block
let previousChunkPointers = Addresses.ps14;  // The start address of the pointers that point to the current chunk
let returnAddr = Addresses.ps15;  // Used to hold the return address provided in psReturnAddr, as psReturnAddr will be overwritten during allocation
let lastChunk = Addresses.ps8 + 1;

let allocatedAddress = Addresses.ps12;  // Reuse ps12 to hold the address of the allocated space

// Variables specific to local allocation
let sizeNeeded = Addresses.ps11;  // In local allocation, chunks record their actual size rather than an exponent, so need to calculate the actual size needed and store it to avoid recalculating it regularly

var AllocationProc = [
    "#allocate AND 0"  // Clear accumulator
]
.concat(
    // First copy the return address, as psReturnAddr will need to be overwritten later
    copy(Addresses.psReturnAddr, returnAddr, 4),
    // Then copy the top item on the Eval stack into ps7 and ps8 (as items are 5 bytes each, it will take the first byte of ps8) as it contains the details of the allocation request
    copy(Addresses.EvalTop, Addresses.psAddr, 4)  // Copy pointer to top item into psAddr
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps7, 5, ProcedureOffset + calculateInstructionsLength(AllocationProc)), // Copy item itself into ps7 and ps8
    [
        // Decide whether to allocate on stack or global heap
        "AND 0",
        `ADD A ${Addresses.ps7 + 2}`,  // If the third byte of details is not 0, then it should be allocated globally regardless of current scope
        "BIZ #allocate_check_scope",  // Third byte is 0, so check if current scope is global
        "GTO #allocate_global",
        "#allocate_check_scope AND 0"
    ],
    // Check if current scope is global by checking if scope pointer is equal to global area start address
    checkEqual(Addresses.ScopePointer, Addresses.GlobalArea, "#allocate_global", "#allocate_local", false, true),
    [
        // Allocate on the global heap
        // First check if the type 32 or 33 (int or float), as this will allow the int/float pool to be used
        `#allocate_global RED ${Addresses.ps7 + 1}`,  // Second byte of details contains the type
        "SUB 32",
        "BIZ #allocate_check_pool_full",
        "ADD 32", // Simply re-adding 32 uses fewer CPU cycles than re-fetching the value from memory
        "SUB 33",
        "BIZ #allocate_check_pool_full",
        
        /*
            Can't use the pool so allocate from heap
            chunkStart = ps9  (pointer to the first address in the chunk currently being searched)
            chunkEnd = ps10 (pointer to the last address in the chunk currently being searched)
            blockStart = ps11 (pointer to the first address of the current block)
            smallestFound = ps12 (pointer to the smallest block found)
            lastChunk = ps8 + 1 (boolean, set to 0 if this is the last chunk (0 used for true to allow BIZ to be used to test for it))
            
        */
        "#allocate_from_global_heap AND 0",
        // Set smallestFound to 0 initially
        `WRT ${smallestFound}`,
        `WRT ${smallestFound + 1}`,
        `WRT ${smallestFound + 2}`,
        `WRT ${smallestFound + 3}`,
        // Set lastChunk to false
        "ADD 1",
        `WRT ${lastChunk}`
        // Pointers for first chunk are stored in global area
    ],
    writeMultiByte(Addresses.GlobalArea + Offsets.frame.StartChunkPointer, previousChunkPointers, 4),
    copy(Addresses.GlobalArea + Offsets.frame.StartChunkPointer, chunkStart, 4),
    copy(Addresses.GlobalArea + Offsets.frame.StartChunkEndPointer, chunkEnd, 4),
    // If chunkStart is 0, then there are no free chunks
    checkZero(chunkStart, 4, "#allocate_insufficient_space", "#allocate_global_search_chunks"),
    [
        `#allocate_global_search_chunks RED ${lastChunk}`,  // If not all free chunks have been searched
        "ADD 0",
        "BIZ #allocate_global_all_chunks_searched",
        // if chunkStart + 1 (the pointer to the next chunk) == 0, then this is the last chunk
        "#allocate_global_check_if_last_chunk AND 0"
    ],
    copy(chunkStart, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    incrementAddress(ProcedureOffset + calculateInstructionsLength(AllocationProc))
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps6, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    checkZero(Addresses.ps6, 4, "#allocate_global_set_last_chunk", "#allocate_global_set_blockStart"),
    [
        "#allocate_global_set_last_chunk AND 0",
        `WRT ${lastChunk}`,
        // Start searching the blocks in the chunk, starting from the first one
        "#allocate_global_set_blockStart AND 0"
    ],
    copy(chunkStart, blockStart, 4),
    [
        "#allocate_global_search_blocks AND 0",
        // if chunkEnd < blockStart then all blocks in this chunk have been searched, so move on to next chunk
    ],
    // To check if blockStart is greater, load blockStart into ps0 and chunkEnd into ps1 so checkGreater procedure can check them
    copy(blockStart, Addresses.ps0, 4),
    copy(chunkEnd, Addresses.ps1, 4),
    // Load the address for checkGreater to jump to if blockStart is greater into psReturnAddr, and the address to jump to otherwise into psAddr
);
// Instead of loading the addresses it is actually supposed to jump to, load addresses of GTO instructions jumping to those addresses.  As calculating these addresses is much easier
AllocationProc.push("GTO #allocate_global_load_checkGreater_return_addresses");
let greaterThanChunkEndJumpAddr = ProcedureOffset + calculateInstructionsLength(AllocationProc);
AllocationProc.push("GTO #allocate_global_next_chunk")  // greaterThanChunkEndJumpAddr will contain address of this instruction
let notGreaterThanChunkEndJumpAddr = ProcedureOffset + calculateInstructionsLength(AllocationProc);
AllocationProc.push("GTO #allocate_global_check_block");  // notGreaterThanChunkEndJumpAddr will contain address of this instruction
AllocationProc = AllocationProc.concat(
    ["#allocate_global_load_checkGreater_return_addresses AND 0"],
    writeMultiByte(greaterThanChunkEndJumpAddr, Addresses.psReturnAddr, 4),
    writeMultiByte(notGreaterThanChunkEndJumpAddr, Addresses.psAddr, 4),
    [
        "GTO #checkGreater",
        "#allocate_global_next_chunk AND 0"
    ],
    // blockStart is greater, so the next free block is not in this chunk.  So move to next chunk
    // Load the chunkStart and chunkEnd pointers from positions 1-4 and 5-8 of this chunk
    copy(chunkStart, Addresses.psAddr, 4)
)
AllocationProc = AllocationProc.concat(
    incrementAddress(ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // psAddr now contains chunkStart + 1, which is the starting address of this chunks pointer to the next chunkStart
    copy(Addresses.psAddr, previousChunkPointers, 4)
)
AllocationProc = AllocationProc.concat(
    copyFromAddress(chunkStart, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The chunkStart of the next chunk is now loaded into chunkStart
)
AllocationProc = AllocationProc.concat(
    copyFromAddress(chunkEnd, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The chunkEnd of the next chunk is now loaded into chunkEnd
    [
        "GTO #allocate_global_search_chunks",  // Search this chunk
        "#allocate_global_check_block AND 0"
        // Convert the exponent to the actual number of bytes(this is done now, although the result isn't needed until later, as it will be needed in both outcomes of the next branch)
    ],
    copy(blockStart, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps0, 1, ProcedureOffset + calculateInstructionsLength(AllocationProc))  // First byte of ps0 now contains the exponent of the size of the current block
    // Write return address to psReturnAddr for Base2Exp to jump to after
);
AllocationProc = AllocationProc.concat(
    writeMultiByte(ProcedureOffset + calculateInstructionsLength(AllocationProc) + calculateInstructionsLength(writeMultiByte(10, Addresses.psReturnAddr, 4)) + calculateInstructionsLength(["GTO #base2Exponent"]), Addresses.psReturnAddr, 4),
    [
        "GTO #base2Exponent",
        "AND 0",  // base2Exponent should jump back to here, and ps0 should now contain the full number of bytes requested
        // Check if the current block is exactly the right size

        `RED A ${blockStart}`,
        `SUB A ${Addresses.ps7}`,
        // If result is 0, the block is exactly the right size so allocate it
        "BIZ #allocate_global_block_found",
        // Code for if block size is incorrect
        // If negative, the block found is too small, so skip to next block
        "BIN #allocate_global_next_block",
        // Result is greater than 0, meaning that this block is too big.  But if it is the smallest found so far, record it in smallestFound to be used in case no perfectly sized blocks can be found
    ],
    checkZero(smallestFound, 4, "#allocate_global_block_isSmallest", "#allocate_global_block_check_if_smallest"),
    [
        `#allocate_global_block_check_if_smallest RED A ${smallestFound}`,
        `WRT ${Addresses.ps4}`,
        `RED A ${blockStart}`,
        `SUB A ${Addresses.ps4}`,
        "BIN #allocate_global_block_isSmallest",  // The block is smaller than the current smallest one
        "GTO #allocate_global_next_block",  // The block is larger than the current smallest one, so go straight to the next block
        "#allocate_global_block_isSmallest AND 0",
        // The found block is too big, but is the smallest found so far (that isn't too small) so record it in smallestFound
    ],
    copy(blockStart, smallestFound, 4),
    copy(previousChunkPointers, smallestFoundPrevPointers, 4),
    [
        "#allocate_global_next_block AND 0",
        // Go to the next block
    ]
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(blockStart, Addresses.ps0, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    copy(Addresses.ps3, blockStart, 4),  // blockStart now contains the start address of the next block
    [
        "GTO #allocate_global_search_blocks",

        // Code for if block size is correct
        // A suitable block has been found, but must reorganise the chunks around it now that it is allocated
        "#allocate_global_block_found AND 0"
        // If *blockStart == *chunkStart and chunkEnd + 1 == *blockStart + block size then this block is its entire chunk
    ],
    checkEqual(blockStart, chunkStart, "#allocate_global_block_found_is_chunkStart", "#allocate_global_block_found_not_chunkStart"),
    [
        "#allocate_global_block_found_is_chunkStart AND 0",
        // Calculate end address of block, and compare with chunkEnd
    ]
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(chunkEnd, 1, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),
    copy(Addresses.ps3, Addresses.ps4, 4)
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(blockStart, Addresses.ps0, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    checkEqual(Addresses.ps3, Addresses.ps4, "#allocate_global_block_found_whole_chunk", "#allocate_global_block_found_not_whole_chunk"),
    [
        "#allocate_global_block_found_whole_chunk AND 0",
        // This block is the entire chunk, so need to remove this chunk by replacing the previous chunk's pointers (or the global ones if this is the first chunk) with this chunk's pointers
    ],
    copy(chunkStart, Addresses.psAddr, 4),
);
AllocationProc = AllocationProc.concat(
    incrementAddress(ProcedureOffset + calculateInstructionsLength(AllocationProc))
);
AllocationProc = AllocationProc.concat(
    // Copy both of this chunk's pointers into ps4 and ps5
    copyFromAddress(Addresses.ps4, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc))
);
AllocationProc = AllocationProc.concat(
    copy(previousChunkPointers, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    // Then write them to the previous chunk's pointers
    copyToAddress(Addresses.ps4, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    [
        "#allocate_global_block_found_not_whole_chunk AND 0",
        // The block is not the whole chunk, but is at the start of it.  Therefore we can simply shrink the chunk by moving the pointer to this chunk forward to the end of the block
        // First move the pointers in this chunk to the new start of the chunk
    ],
    copy(chunkStart, Addresses.psAddr, 4),
);
AllocationProc = AllocationProc.concat(
    incrementAddress(ProcedureOffset + calculateInstructionsLength(AllocationProc))
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps4, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc))
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(blockStart, Addresses.ps0, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    incrementAddress(ProcedureOffset + calculateInstructionsLength(AllocationProc))
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps4, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The block after the one allocated now contains the current chunk's pointers
    // Now replace the start pointer to this chunk with the address of the next block
    copy(previousChunkPointers, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps3, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The pointers to this chunk now have the new start location
    [
        "GTO #allocate_finish",
        "#allocate_global_block_found_not_chunkStart AND 0",
    ]
);
AllocationProc = AllocationProc.concat(
    // Check if block is at the end of the chunk
    add32BitIntegers(blockStart, Addresses.ps0, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    copy(Addresses.ps3, Addresses.ps4, 4)
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(chunkEnd, 1, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),
    checkEqual(Addresses.ps3, Addresses.ps4, "#allocate_global_block_found_is_chunkEnd", "#allocate_global_block_found_not_boundary"),
    [
        "#allocate_global_block_found_is_chunkEnd AND 0",
        // The block is the last one in the chunk, so we can simply adjust the end pointer to shrink the chunk
    ],
);
AllocationProc = AllocationProc.concat(
    // The new end of the chunk will be the byte before the start of the block
    add32BitIntegers(blockStart, -1, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),
    copy(Addresses.ps3, Addresses.ps4, 4)
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(previousChunkPointers, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),
    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps4, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The end pointer to the current chunk now contains the new end of the chunk
    [
        "#allocate_global_block_found_not_boundary AND 0",
        // The block is not at the start or end of the chunk, so must split the chunk into two around it
    ]
);
AllocationProc = AllocationProc.concat(
        // Move the pointers in the current chunk to after the block
        add32BitIntegers(blockStart, Addresses.ps0, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
        copy(Addresses.ps3, Addresses.ps4, 4),  // ps4 now contains the first address after the block (i.e. the first address in the new chunk)
        copy(chunkStart, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    incrementAddress(ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps5, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // ps5 and ps6 now contain the pointers from the current chunk
    copy(Addresses.ps4, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    incrementAddress(ProcedureOffset + calculateInstructionsLength(AllocationProc))
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps5, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The new chunk now contains the pointers from the old one
    // Change the pointers in the old chunk to point to the start and end of the new one
    //      - ps4 already contains the start address
    //      - chunkEnd already contains the end address
    // Copy chunkEnd to ps5 to allow a single call to copyToAddress()
    copy(chunkEnd, Addresses.ps5, 4),
    copy(chunkStart, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    incrementAddress(ProcedureOffset + calculateInstructionsLength(AllocationProc))
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps4, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The pointers in the old chunk now contain the start and end addresses of the new one
);
AllocationProc = AllocationProc.concat(
    // Update the chunkEnd pointer in the previous chunk
    add32BitIntegers(blockStart, -1, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),
    copy(Addresses.ps3, Addresses.ps4, 4),  // ps4 now contains the last address of the old chunk
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(previousChunkPointers, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),
    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps4, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The previous chunk's next chunk end pointer now points to the end of the new chunk
    copy(blockStart, allocatedAddress, 4),  // allocatedAddress now contains the address of the allocated block
    [
        "GTO #allocate_finish",
        "#allocate_global_all_chunks_searched AND 0",
        // All chunks have been searched, and no perfectly sized block has been found so split the smallest block in half and repeat until it is the right size
    ],
    // First check if smallestFound is 0, as this would mean there are no blocks large enough
    checkZero(smallestFound, 4, "#allocate_insufficient_space", "#allocate_global_split_block"),
    [
        `#allocate_global_split_block RED A ${smallestFound}`,
        `SUB A ${Addresses.ps7}`,
        `BIZ #allocate_global_splitting_complete`,  // The block is now the right size, no more splitting is needed
        // The block needs to be split
        `RED A ${smallestFound}`,
        "SUB 1",  // Subtract 1 to get the size of the block when halved
        // Calculate the full size in bytes of the block after halving
        `WRT ${Addresses.ps4}`,  // Store new size as exponent in ps4
        `WRT ${Addresses.ps0}`
    ]
);
AllocationProc = AllocationProc.concat(
    writeMultiByte(ProcedureOffset + calculateInstructionsLength(AllocationProc) + calculateInstructionsLength(writeMultiByte(10, Addresses.psReturnAddr, 4)) + calculateInstructionsLength(["GTO #base2Exponent"]), Addresses.psReturnAddr, 4),
    [
        "GTO #base2Exponent"  // ps0 now contains the size of the new block in bytes
    ]
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(smallestFound, Addresses.ps0, ProcedureOffset + calculateInstructionsLength(AllocationProc)), // ps3 now contains the start address of the second half of the block
    [
        // Write the new size to the first bytes of both halves of the block, thus splitting it into two blocks
        `RED ${Addresses.ps4}`,
        `WRT A ${Addresses.ps3}`,
        `WRT A ${smallestFound}`,  // The block has now been split into two
        "GTO #allocate_global_split_block",

        "#allocate_global_splitting_complete AND 0",
        // Use smallestFoundPrevPointers to obtain the correct chunk details so we can just jump back to the start of the procedure and it will immediately find the correctly sized block we just created
    ],
    copy(smallestFoundPrevPointers, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(chunkStart, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc))  // chunkStart now contains the start address of the chunk that contains the correct block
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(chunkEnd, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // chunkEnd now contains the end address of the chunk that contains the correct block
    copy(smallestFoundPrevPointers, previousChunkPointers, 4),  // previousChunkPointers now contains the address of the pointers to the chunk that contains the correct block
    copy(smallestFound, blockStart, 4),  // blockStart now contains the start address of the correct block
    [
        // Can now simply jump to #allocate_global_block_found to allocate the block and handle restructuring the chunks around it
        "GTO #allocate_global_block_found",

        // Int or float so allocate from int/float pool (if isn't full)
        "#allocate_check_pool_full AND 0"
    ],
    // We know the pool is full if the PoolFreePointer points to the address following the end of the pool
    checkEqual(Addresses.PoolFreePointer, Addresses.IntFloatPool + runtime_options.IntFloatPoolSize, "#allocate_from_global_heap", "#allocate_from_pool", false, true),
    [
        // Allocate the first free space in the pool (it is pointed to by PoolFreePointer)
        "#allocate_from_pool AND 0",
    ],
    copy(Addresses.PoolFreePointer, allocatedAddress, 4),
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
        `#allocate_increment_pool_ptr_c2 RED ${Addresses.PoolFreePointer + 1}`,
        "ADD 1",
        `WRT ${Addresses.PoolFreePointer + 1}`,
        "BIC #allocate_increment_pool_ptr_c3",
        "GTO #allocate_finish",
        `#allocate_increment_pool_ptr_c3 RED ${Addresses.PoolFreePointer}`,
        "ADD 1",
        `WRT ${Addresses.PoolFreePointer}`,
        "GTO #allocate_finish",

        // The space does contain another pointer, so simply load that into PoolFreePointer
        "#allocate_update_pool_pointer_pointer AND 0",
    ],
    copy(Addresses.ps2, Addresses.PoolFreePointer, 4),
    [
        "GTO #allocate_finish",

        /* Allocate on local heap */
        "#allocate_local AND 0",
    ],
);
AllocationProc = AllocationProc.concat(
    // Load pointers into registers
    // previousChunkPointers should contain the address of the current chunk pointers themselves
    add32BitIntegers(Addresses.ScopePointer, Offsets.frame.StartChunkPointer, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),
    copy(Addresses.ps3, previousChunkPointers, 4),
    // chunkStart and chunkEnd should contain the address of the start and end of the current chunk
    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(chunkStart, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc))
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(chunkEnd, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    // Calculate needed size
    copy(Addresses.ps7, Addresses.ps0, 1),
);
AllocationProc = AllocationProc.concat(
    writeMultiByte(ProcedureOffset + calculateInstructionsLength(AllocationProc) + calculateInstructionsLength(["GTO #base2Exponent"]), Addresses.psReturnAddr, 4),
    [
        "GTO #base2Exponent",
    ],
    copy(Addresses.ps0, sizeNeeded, 4),  // sizeNeeded now contains the full size needed in bytes
    // Start checking for a chunk large enough
    [
        "#allocate_local_check_chunk AND 0",
    ],
    // If chunkStart is 0 then there are no more free chunks that have not been searched, so there isn't enough space
    checkZero(chunkStart, 4, "#allocate_stack_overflow", "#allocate_local_check_chunk_size"),
    [
        "#allocate_local_check_chunk_size AND 0",
    ],
    // Check if chunk is exactly the right size
    copy(chunkStart, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps4, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    checkEqual(sizeNeeded, Addresses.ps4, "#allocate_local_chunk_perfect", "#allocate_local_chunk_imperfect"),
    [
        "#allocate_local_chunk_perfect AND 0",
        // The chunk is exactly the right size, so allocate it and remove it from the list of chunks
        // Check if this is the last chunk
    ]
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(Addresses.ScopePointer, Offsets.frame.LastChunkStartPointer, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),
    copy(Addresses.ps3, Addresses.psAddr)
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps5, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // ps5 now contains the start address of the last chunk
    checkEqual(chunkStart, Addresses.ps5, "#allocate_local_found_chunk_isLast", "#allocate_local_chunk_not_last"),
    [
        "#allocate_local_found_chunk_isLast AND 0",
        // The found chunk is the last one, so change the previous pointers to 0 to show there are no more free chunks
    ],
    copy(previousChunkPointers, Addresses.psAddr, 4),
    writeMultiByte(0, Addresses.ps0, 8)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps0, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // Pointers to this chunk now contain 0
    // Point LastChunkStartPointer and StackPointer to the end of stack, as the newly allocated space uses the rest of the space on the stack
    writeMultiByte(Addresses.StackStart + runtime_options.StackSize, Addresses.ps0, 4),
    copy(Addresses.ps0, Addresses.StackPointer, 4)  // StackPointer now contains the address after the end of the stack
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(Addresses.ScopePointer, Offsets.frame.LastChunkStartPointer, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),
    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps0, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // LastChunkStartPointer now contains the address after the end of the stack
    copy(chunkStart, allocatedAddress, 4),
    [
        "GTO #allocate_finish",

        "#allocate_local_chunk_not_last AND 0",
        // The chunk is not the last one, so change the pointers that pointed to this chunk to point to the next one instead
    ]
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(chunkStart, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),
    copy(Addresses.ps3, Addresses.psAddr, 4),
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps4, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // ps4 and ps5 now contain the pointers to the next chunk
    copy(previousChunkPointers, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps4, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The pointers in the previous chunk now contain the pointers from this chunk (so this chunk has been removed from the list of free chunks)
    copy(chunkStart, allocatedAddress, 4),
    [
        "GTO #allocate_finish",

        "#allocate_local_chunk_imperfect AND 0",
        // The chunk is not exactly the right size, check if it is too small or too big
        "GTO #allocate_local_load_checkGreater_return_addresses"
    ]
);
// Load in return addresses for CheckGreaterProc.  Instead of using the actual addresses, use addresses of GTO instructions that jump to those instructions as these are easier to calculate
let chunkLargerThanNeededJumpAddr = ProcedureOffset + calculateInstructionsLength(AllocationProc);
AllocationProc.concat("GTO #allocate_local_chunk_too_big");  // chunkLargerThanNeededJumpAddr will contain address of this instruction
let chunkSmallerThanNeededJumpAddr = ProcedureOffset + calculateInstructionsLength(AllocationProc);
AllocationProc.concat("GTO #allocate_local_next_chunk");  // chunkSmallerThanNeededJumpAddr will contain address of this instruction
AllocationProc = AllocationProc.concat(
    [
        "#allocate_local_load_checkGreater_return_addresses AND 0"
    ],
    writeMultiByte(chunkLargerThanNeededJumpAddr, Addresses.psReturnAddr, 4),
    writeMultiByte(chunkSmallerThanNeededJumpAddr, Addresses.psAddr, 4),
    copy(Addresses.ps4, Addresses.ps0, 4),  // The size of the current chunk should still be in ps4
    copy(sizeNeeded, Addresses.ps1, 4),
    [
        "GTO #checkGreater",
        "#allocate_local_chunk_too_big AND 0",
        // Chunk is too large, so allocate only as much as is needed
    ]
);
AllocationProc = AllocationProc.concat(
    // Calculate the size of the free chunk after allocating however much we need
    sub32BitInteger(Addresses.ps4, sizeNeeded, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    copy(Addresses.ps3, Addresses.ps5, 4),  // ps5 now contains the size of the chunk after taking the amount needed
    copy(chunkStart, allocatedAddress, 4)
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(chunkStart, sizeNeeded, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // ps3 now contains the new start address of the chunk
    // Write new size of the chunk to first 4 bytes

    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps5, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    // Copy pointers from existing chunk start to new start of the chunk
    copy(Addresses.ps3, Addresses.ps4, 4),  // Save ps3 (the new start address of the chunk) into ps4 as add procedure will overwrite it
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(chunkStart, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),  // ps3 now contains the address of the first pointer in the current chunk
    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps5, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // ps5 and ps6 now contain the pointers from the current chunk
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(Addresses.ps4, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),  // ps3 now contains the first address that the pointers should be copied to
    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps5, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // Pointers have now been copied to the new start of the chunk
    // Change the pointer to this chunk to point to the new start
    copy(previousChunkPointers, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps4, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The pointer to the start of this chunk now points to the new start (the end pointer does not need changing)
    // If this is the last chunk, we must also update the LastChunkStartPointer and StackPointer
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(Addresses.ScopePointer, Offsets.frame.LastChunkStartPointer, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),  // ps3 now contains the address of the LastChunkPointer for the current scope
    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(Addresses.ps5, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // ps5 now contains the address of the LastChunkStart
    checkEqual(Addresses.ps5, chunkStart, "#allocate_local_reduced_chunk_isLast", "#allocate_finish"),
    [
        "#allocate_local_reduced_chunk_isLast AND 0"
    ],
    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps4, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The LastchunkStart pointer for this scope now points to the new start of the chunk
    copy(Addresses.ps4, Addresses.StackPointer, 4),  // StackPointer now points to new start of chunk
    [
        "GTO #allocate_finish",
        
        "#allocate_local_next_chunk AND 0",
        // The current chunk is too small, try the next one
    ]
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(chunkStart, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),  // ps3 now contains the address of this chunk's pointer to the start of next chunk
    copy(Addresses.ps3, previousChunkPointers, 4),  // previousChunkPointers now contains the address of this chunk's pointers to the next chunk
    copy(Addresses.ps3, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(chunkStart, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // chunkStart now contains the start address of the next chunk
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(previousChunkPointers, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc), false, true),  // ps3 now contains the address of this chunk's pointer to the end of the next chunk
    copy(Addresses.ps3, Addresses.psAddr, 4),
);
AllocationProc = AllocationProc.concat(
    copyFromAddress(chunkEnd, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    [
        "GTO #allocate_local_check_chunk",

        "#allocate_finish AND 0",
        // Allocation is complete, so write allocatedAddress to eval stack and return.  There is no need to add entry to eval stack, as we can just overwrite the one that was provided when calling this procedure
    ],
        copy(Addresses.EvalTop, Addresses.psAddr, 4)
);
AllocationProc = AllocationProc.concat(
    copyToAddress(allocatedAddress, 4, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // Top item on Eval stack now contains allocated address
    [
        // Return to address provided by calling procedure
        `GTO A ${returnAddr}`,

        // Branches for if there is too little space to allocate
        // THESE NEED TO BE WRITTEN WHEN ERROR HANDLING IS SET UP
        "#allocate_insufficient_space AND 0",  // Used in global allocation when there isn't enough space
        "#allocate_stack_overflow AND 0",  // Used in local (stack) allocation when there isn't enough space
        // TEMPORARY.  NOTIFY INSUFFICIENT SPACE BY outputting F (142) on seven segment display
        "ADD 142",
        "OUT",
        "END"
    ]
);

ProcedureOffset += calculateInstructionsLength(AllocationProc);  // Increase ProcedureOffset to contain the start address of the next contant procedure
/*
    Procedure for checking if one 4 byte unsigned int value is greater than another
    The details are provided in the pseudoregisters:
        - psReturnAddr = the address to branch to if x is greater
        - psAddr = the address to branch to if x is not greater
        - ps0 = x
        - ps1 = y
*/
var CheckGreaterProc = [
    // First XOR corresponding bytes together to identify the first byte that differs (as XORing will leave only bytes that are different, so if the result is 0 we know the bytes are identical)
    `#checkGreater RED ${Addresses.ps0}`,
    `XOR A ${Addresses.ps1}`,
    // If the bytes are the same, then move on the the next byte
    "BIZ #checkGreater_byte2",
    // Otherwise do the check on this byte
    "GTO #checkGreater_check",

    `#checkGreater_byte2 RED ${Addresses.ps0 + 1}`,
    `XOR A ${Addresses.ps1 + 1}`,
    "BIZ #checkGreater_byte3",
    // Otherwise load the bytes into the first position in the registers and jump to checkGreater_check
    `RED ${Addresses.ps0 + 1}`,
    `WRT ${Addresses.ps0}`,
    `RED ${Addresses.ps1 + 1}`,
    `WRT ${Addresses.ps1}`,
    "GTO #checkGreater_check",

    `#checkGreater_byte3 RED ${Addresses.ps0 + 2}`,
    `XOR A ${Addresses.ps1 + 2}`,
    "BIZ #checkGreater_byte4",
    `RED ${Addresses.ps0 + 2}`,
    `WRT ${Addresses.ps0}`,
    `RED ${Addresses.ps1 + 2}`,
    `WRT ${Addresses.ps1}`,
    "GTO #checkGreater_check",

    `#checkGreater_byte4 RED ${Addresses.ps0 + 3}`,
    `XOR A ${Addresses.ps1 + 3}`,
    // All the bytes are the same, so x is not greater
    `BIZ A ${Addresses.psAddr}`,
    `RED ${Addresses.ps0 + 3}`,
    `WRT ${Addresses.ps0}`,
    `RED ${Addresses.ps1 + 3}`,
    `WRT ${Addresses.ps1}`,
    "GTO #checkGreater_check",

    // The process for actually checking if the byte is greater or smaller (we only need to check one byte as we are working from MSB)
    // Important to keep in mind here than "negative" numbers are larger than positive ones (as this is unsigned, so we don't care about negativity.  But if the negative flag is set it will mean the MSb is set)
    `#checkGreater_check RED ${Addresses.ps0}`,
    // Check if x is negative.  If it is negative and y is positive then x is bigger (as negative will mean sign bit is set and this is unsigned)
    "BOR 0",  // ORed with 0 as read operations do not set the flags
    "BIN #checkGreater_x_neg",
    
    // x is not negative, check if y is
    `RED ${Addresses.ps1}`,
    "BOR 0",
    // x is not negative, but y is.  So y must be larger.
    `BIN A ${Addresses.psAddr}`,
    // Both have the same sign, so subtract y from x.  If x is bigger, the result will be positive
    `#checkGreater_same_sign RED ${Addresses.ps0}`,
    `SUB A ${Addresses.ps1}`,
    `BIN A ${Addresses.psAddr}`,  // Result is negative, so x is not greater
    `GTO A ${Addresses.psReturnAddr}`,  // Result is positive, so IS greater

    `#checkGreater_x_neg RED ${Addresses.ps1}`,
    // Check if both are negative
    "BOR 0",
    "BIN #checkGreater_same_sign",
    // Otherwise x is neg and y is pos, meaning x must be greater
    `GTO A ${Addresses.psReturnAddr}`,
]

ProcedureOffset += calculateInstructionsLength(CheckGreaterProc);  // Increase ProcedureOffset to contain the start address of the next constant procedure

/* 
    Procedure for calculating exponents to base 2 (exponents between 0 and 31)
    Takes the exponent as an 8 bit int in ps0 and leaves the result in ps0
    Branches to the address in psReturnAddr when done
*/
var Base2ExponentProc = [
    // Write the address of ps0 + 3 into ps1, as ps1 should contain the address of the byte that will contain the 1.  This will be changed as the correct byte is worked out
    "#base2Exponent AND 0",
].concat(
    writeMultiByte(Addresses.ps0 + 3, Addresses.ps1, 4),
    [
        // First determine which byte of the result should contain the 1 by counting how many times 8 goes into the exponent
        `RED ${Addresses.ps0}`,
        "SUB 8",
        "BIN #base2Exponent_setBit",  // If the result is negative, no more 8's can go into it so the address in ps1 is correct
        // Otherwise write the result back to ps0 as we need to subtract 8 from it again
        `WRT ${Addresses.ps0}`
        // Write the address of the next most significant byte of ps0 to ps1
    ],
    writeMultiByte(Addresses.ps0 + 2, Addresses.ps1, 4),
    [
        `RED ${Addresses.ps0}`,
        "SUB 8",
        "BIN #base2Exponent_setBit",  // If the result is negative, no more 8's can go into it so the address in ps1 is correct
        // Otherwise write the result back to ps0 as we need to subtract 8 from it again
        `WRT ${Addresses.ps0}`
        // Write the address of the next most significant byte of ps0 to ps1
    ],
    writeMultiByte(Addresses.ps0 + 1, Addresses.ps1, 4),
    [
        `RED ${Addresses.ps0}`,
        "SUB 8",
        "BIN #base2Exponent_setBit",  // If the result is negative, no more 8's can go into it so the address in ps1 is correct
        // Otherwise write the result back to ps0 as we need to subtract 8 from it again
        `WRT ${Addresses.ps0}`
        // Write the address of the next most significant byte of ps0 to ps1
    ],
    writeMultiByte(Addresses.ps0, Addresses.ps1, 4),
    
    // We now know which byte of the result should contain the 1, we just need to work out which bit will be 1
    // Do this by starting with a value of 1, and adding itself to it (to shift it left) x times, where x is the remainder from the previous subtractions (ps0)
    [
        "#base2Exponent_setBit AND 0",
        "ADD 1",
        `WRT ${Addresses.ps2}`,
        "AND 0",
        `ADD A ${Addresses.ps0}`,
        "#base2Exponent_shift BIZ #base2Exponent_shiftsComplete",
        `RED ${Addresses.ps2}`,
        `ADD A ${Addresses.ps2}`,  // Add to itself (left shift)
        `WRT ${Addresses.ps2}`,
        `RED ${Addresses.ps0}`,
        `SUB 1`,
        `WRT ${Addresses.ps0}`,
        "GTO #base2Exponent_shift",
        // Finally clear ps0 ready to hold the result
        "#base2Exponent_shiftsComplete AND 0",
        `WRT ${Addresses.ps0}`,
        `WRT ${Addresses.ps0 + 1}`,
        `WRT ${Addresses.ps0 + 2}`,
        `WRT ${Addresses.ps0 + 3}`,
        // Then write result to correct byte of ps0 (specified in ps1) and jump to address in psReturnAddr
        `RED ${Addresses.ps2}`,
        `WRT A ${Addresses.ps1}`,
        `GTO A ${Addresses.psReturnAddr}`
    ]
);

ProcedureOffset += calculateInstructionsLength(Base2ExponentProc);  // Increase ProcedureOffset to contain the start address of the next procedure

/*
    Procedure for allocating space on a name pool
    The details of how much space is needed, and from where, is provided on the top entry of EvalStack:
        - EvalTop[0] = Number of 5 byte "blocks" needed
        - EvalTop[1] = Set to 1 to force the space to be allocated from the global name pool.

    Upon completion, the first address of the allocated space is placed in the first four bytes of EvalTop
*/
let neededNameDetails = Addresses.ps7;  // Contains a copy of the details provided on the EvalStack
let namePoolPointer = Addresses.ps8;  // Address of the name pool to be used
let currentFreeSpacePtr = Addresses.ps9;  // The address of the free space currently being searched
let currentFreeSpaceSize = Addresses.ps7 + 2;  // The size of the free space currently being searched (only 1 byte so can use one of the unused bytes in ps7)
let currentFreeSpaceDetailsPtr = Addresses.ps10;  // The address of the details of the current free space

var AllocateNameProc = [
    "#allocateName AND 0"
].concat(
    // First copy the details from EvalTop to neededNameDetails
    copy(Addresses.EvalTop, Addresses.psAddr, 4)
);
AllocateNameProc = AllocateNameProc.concat(
    copyFromAddress(neededNameDetails, 2, ProcedureOffset + calculateInstructionsLength(AllocateNameProc)),
    [
    // Load the correct name pool address into namePoolPointer
    `RED ${neededNameDetails + 1}`,
    `BIZ #allocateName_current_scope`,
    // EvalTop[1] is set, so allocate globally
    ],
    writeMultiByte(Addresses.GlobalArea + Offsets.frame.NamePoolPointer, namePoolPointer, 4),
    [
    "GTO #allocateName_searchPool",
    // EvalTop[1] is not set, so allocate in current scope
    "#allocateName_current_scope AND 0"
    ]
);
AllocateNameProc = AllocateNameProc.concat(
    add32BitIntegers(Addresses.ScopePointer, Offsets.frame.NamePoolPointer, ProcedureOffset + calculateInstructionsLength(AllocateNameProc), false, true),  // ps3 now contains the address of the current scope's name pool
    copy(Addresses.ps3, namePoolPointer, 4),
    [
    
    // Search the pool for a large enough free space
    "#allocateName_searchPool AND 0"
    ]
);
// Load in the details of the first free space
AllocateNameProc = AllocateNameProc.concat(
    // Details of first free space start at 2nd byte of pool headers
    add32BitIntegers(namePoolPointer, 1, ProcedureOffset + calculateInstructionsLength(AllocateNameProc), false, true),
    copy(Addresses.ps3, currentFreeSpaceDetailsPtr, 4),
    copy(currentFreeSpaceDetailsPtr, Addresses.psAddr, 4),
);
AllocateNameProc = AllocateNameProc.concat(
    copyToAddress(currentFreeSpacePtr, 4, ProcedureOffset + calculateInstructionsLength(AllocateNameProc)),  // currentFreeSpacePtr now contains the address of the first free space in the pool
);
AllocateNameProc = AllocateNameProc.concat(
    copyToAddress(currentFreeSpaceSize, 1, ProcedureOffset + calculateInstructionsLength(AllocateNameProc)), // currentFreeSpaceSize now contains the size (in blocks) of the first free space
    [
    // Check if current space is large enough
    `#allocateName_checkSpace RED ${currentFreeSpaceSize}`,
    `SUB A ${neededNameDetails}`,
    "BIZ #allocateName_spacePerfect" ,
    "BIN #allocateName_spaceTooSmall",
    // The space is larger than we need, so take only as much as is needed
    "#allocateName_spaceTooBig AND 0",
    ]
    // We will take the space needed from the start of this chunk, so adjust the pointer to this chunk to point to the new start and decrease it's size field accordingly
);
AllocateNameProc = AllocateNameProc.concat(
    // add32BitIntegers(currentFreeSpacePtr, "NEED TO MULTIPLY: multiply32BitIntegers(neededNameDetails, NamePool._blockSize)"),
    [

    // The space is exactly the right size
    "#allocateName_spacePerfect AND 0",
    // The space is too small, so move onto the next one
    "#allocateName_spaceTooSmall AND 0"
    ]
)

ProcedureOffset += calculateInstructionsLength(AllocateNameProc)

/*
    Procedure for multiplying signed integers
    Takes the 32 bit multiplicand in ps0, and 32 bit multiplier in ps1, and leaves the 32 bit result in ps4
*/
let intMultiplicand = Addresses.ps0;
let intMultiplier = Addresses.ps1;
let intMultResult = Addresses.ps4;
let intMultResultNegative = Addresses.ps5;  // One byte.  If set, the result should be negative
let intMultExponent = Addresses.ps5 + 1;  // One byte. Records which bit of the multiplier we are checking
let intMultiplierCurrentBit = Addresses.ps5 + 2;  // One byte.  A counter to tell us when we have checked each bit in a byte
let intMultiplierCurrentByte = Addresses.ps5 + 3;  // One byte.  Contains the current byte of multiplier, shifted as necessary
let intMultiplierByteIndex = Addresses.ps6 + 3;  //   Index of the byte of multiplier currently being checked.  NOTE: Although this is one byte, it requires a whole pseudo-register and must be in the last byte (this allows it to be added to 32 bit addresses).
let intMultiplicandShifted = Addresses.ps7;  // Holds version of multiplicand while it is being shifted
var IntMultProc = [
    "#intMult AND 0",
    // Make sure result register contains 0 initially
    `WRT ${intMultResult}`,
    `WRT ${intMultResult + 1}`,
    `WRT ${intMultResult + 2}`,
    `WRT ${intMultResult + 3}`,

    // Both operands need to be positive, so flip any negative ones and set intMultResultNegative for later
    `WRT ${intMultResultNegative}`,  // Make sure intMultResultNegative is 0 initially
    `ADD A ${intMultiplicand}`,
    "BIN #intMult_flipMultiplicand",
    "#intMult_checkMultiplierSign AND 0",
    `ADD A ${intMultiplier}`,
    "BIN #intMult_flipMultiplier",
    "GTO #intMult_startMult",

    // When flipping operands invert intMultResultNegative, rather than setting it explicitly, as if both operands are negative the result will be positive
    // Multiplicand is negative, so flip it to positive and invert intMultResultNegative
    `#intMult_flipMultiplicand RED ${intMultResultNegative}`,
    "NOT",
    `WRT ${intMultResultNegative}`
]
IntMultProc = IntMultProc.concat(
    flip32BitInt2C(intMultiplicand, ProcedureOffset + calculateInstructionsLength(IntMultProc)),
    [
    "GTO #intMult_checkMultiplierSign",
    `#intMult_flipMultiplier ADD A ${intMultResultNegative}`,
    "NOT",
    `WRT ${intMultResultNegative}`,
    ]
);
IntMultProc = IntMultProc.concat(
    flip32BitInt2C(intMultiplier, ProcedureOffset + calculateInstructionsLength(IntMultProc)),
    [
    // Prepare to start the multiplication
    "#intMult_startMult AND 0",
    `WRT ${intMultiplierByteIndex}`,  // Load 0 into intMultiplierByteIndex, as we will start checking from the byte in intMultiplier + 0
    // The exponent of the bit currently being checked determines how many shifts will be needed.  Start at 30 as we can ignore the MSBit (which would have exponent 31) as we know it will always be 0 as we flipped operands to positive 
    "ADD 30",
    `WRT ${intMultExponent}`,
    // Load the MSByte of multiplier into intMultiplierCurrentByte, shifting out the MSBit as we can ignore it
    `RED ${intMultiplier}`,
    `ADD A ${intMultiplier}`,  // Add to itself to shift left (as CPU does not have shift instructions)
    `WRT ${intMultiplierCurrentByte}`,
    // Load 7 into intMultiplierCurrentBit (usually this would be 8, but we are starting from the second most significant byte)
    "AND 0",
    "ADD 7",
    `WRT ${intMultiplierCurrentBit}`
    ]
);
IntMultProc = IntMultProc.concat(
    [
        /* 
            Perform the actual multiplication
            For each bit in multiplier:
                - If it is 1, left shift multiplicand by ${intMultExponent} places and add to result
                    - If the result of either the shifts or addition uses more than 32 bits, then we have overflowed and the multiplication cannot be done in 32 bits
                - Otherwise skip straight to next bit
        */
       `#intMult_compute AND 0`,
       `ADD A ${intMultiplierCurrentByte}`,
       "BIN #intMult_shiftAdd",  // If MSBit is 1, negative flag will be set so we can use BIN to determine if bit is 1
       // Decrement counter, shift intMultiplierCurrentByte (so that the next bit to be checked is in MSBit position), then repeat
       `#intMult_nextBit RED ${intMultiplierCurrentBit}`,
       "SUB 1",
       "BIZ #intMult_nextByte",  // The counter has reached 0, so this whole byte has been checked.  So move to the next one
       `WRT ${intMultiplierCurrentBit}`,
       `RED ${intMultiplierCurrentByte}`,
       `ADD A ${intMultiplierCurrentByte}`,  // Add to itself to shift left
       `WRT ${intMultiplierCurrentByte}`,
       // Decrement intMultExponent
       `RED ${intMultExponent}`,
       "SUB 1",
       `WRT ${intMultExponent}`,
       "GTO #intMult_compute",

       // Move to next byte
       `#intMult_nextByte RED ${intMultiplierByteIndex}`,
       "ADD 1",
       `WRT ${intMultiplierByteIndex}`,
       // If byteIndex == 4, then we have checked all bytes
       "SUB 4",
       "BIZ #intMult_setSign",
       // Otherwise, reset counter to 8 and load the new byte into intMultiplierCurrentByte
       "AND 0",
       "ADD 8",
       `WRT ${intMultiplierCurrentBit}`,
    ]
);
IntMultProc = IntMultProc.concat(
    add32BitIntegers(intMultiplier, intMultiplierByteIndex, ProcedureOffset + calculateInstructionsLength(IntMultProc)),
    copy(Addresses.ps3, Addresses.psAddr, 4),  // psAddr now contains the address containing the next byte of multiplier to be checked
);
IntMultProc = IntMultProc.concat(
    copyFromAddress(intMultiplierCurrentByte, 1, ProcedureOffset + calculateInstructionsLength(IntMultProc)),
    [
        "GTO #intMult_compute",

        // Left shift multiplicand by ${intMultExponent} places and add to result
        /* First need to copy intMultExponent into a counter to keep track of how many shifts we have done
           As this will only take one byte and is only needed temporarily, we can use one of the unused bytes in intMultiplierByteIndex for this to avoid wasting space (as long as we set it back to 0 after) */
        `#intMult_shiftAdd RED ${intMultExponent}`,
        `WRT ${intMultiplierByteIndex - 1}`,
    ],
    copy(intMultiplicand, intMultiplicandShifted, 4),
    [
        `#intMult_shift RED ${intMultiplierByteIndex - 1}`,
        "BIZ #intMult_add"  // If shift counter is zero, no more shifts are needed so add to result
    ]
);
IntMultProc = IntMultProc.concat(
    add32BitIntegers(intMultiplicandShifted, intMultiplicandShifted, ProcedureOffset + calculateInstructionsLength(IntMultProc)),
    // Check for overflow
    [
        "AND 0",
        `ADD A ${Addresses.ps2}`,  // If there is overflow, ps2 will not contain 0
        `BIZ #intMult_shiftNoOverflow`,
        // ELSE THROW OVERFLOW ERROR.  NEED TO DO THIS WHEN ERRORS ARE IMPLEMENTED
    ],
    copy(Addresses.ps3, intMultiplicandShifted, 4),
    [
        `#intMult_shiftNoOverflow RED ${intMultiplierByteIndex - 1}`,
        "SUB 1",
        `WRT ${intMultiplierByteIndex - 1}`,
        "GTO #intMult_shift",
        "#intMult_add AND 0",
    ]
);
IntMultProc = IntMultProc.concat(
    add32BitIntegers(intMultiplicandShifted, intMultResult, ProcedureOffset + calculateInstructionsLength(IntMultProc)),
    copy(Addresses.ps3, intMultResult, 4),  // The shifted value has been added to result
    // Check for overflow
    [
        "AND 0",
        `ADD A ${Addresses.ps2}`,
        "BIZ #intMult_nextBit",
        // ELSE THROW OVERFLOW ERROR.  NEED TO DO THIS WHEN ERRORS ARE IMPLEMENTED

        // Make result negative if necessary
        "#intMult_setSign AND 0",
        `ADD A ${intMultResultNegative}`,
        "BIZ #intMult_finish",  // If intMultResultNegative is 0 then we don't need to do anything
    ]
);
IntMultProc = IntMultProc.concat(
    flip32BitInt2C(intMultResult, ProcedureOffset + calculateInstructionsLength(IntMultProc)),
    // Exit procedure
    [
        `#intMult_finish GTO A ${Addresses.psReturnAddr}`
    ]
);
ProcedureOffset += calculateInstructionsLength(IntMultProc);

// Return all the procedures as a single array of instructions (must be concatenated in same order as defined, otherwise addresses that used ProcedureOffset will be incorrect)
return [`GTO ${ProcedureOffset}`]  // Skip over the procedure definitions, as we don't actually want to run them during set up
    .concat(AllocationProc)
    .concat(CheckGreaterProc)
    .concat(Base2ExponentProc)
    .concat(AllocateNameProc)
    .concat(IntMultProc);
}


