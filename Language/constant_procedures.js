/*
    Defines instructions for common procedures that will be used repeatedly (e.g. LOAD, ALLOCATE)
    These are simply be added to the start of the program, and then accessed using GTO when necessary
    This is far more memory efficient than having a copy of the same procedure whenever it is used

    When done, they jump to the address in psReturnAddr
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

let chunkStart = Addresses.ps2;
let chunkEnd = Addresses.ps3;
let blockStart = Addresses.ps4;
let smallestFound = Addresses.ps5;
let smallestFoundPrevPointers = Addresses.ps6;  // The address of the chunk pointers that point to the chunk that contains the smallestFound block
let previousChunkPointers = Addresses.ps7;  // The start address of the pointers that point to the current chunk
let lastChunk = Addresses.ps1 + 1;
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
        
        /*
            Can't use the pool so allocate from heap
            chunkStart = ps2  (pointer to the first address in the chunk currently being searched)
            chunkEnd = ps3 (pointer to the last address in the chunk currently being searched)
            blockStart = ps4 (pointer to the first address of the current block)
            smallestFound = ps5 (pointer to the smallest block found)
            lastChunk = ps1 + 1 (boolean, set to 0 if this is the last chunk (0 used for true to allow BIZ to be used to test for it))
            
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
let greaterThanChunkEndJumpAddr = ProcedureOffset + calculateInstructionsLength(AllocationProc);
AllocationProc.push("GTO #allocate_global_next_chunk")  // greaterThanChunkEndJumpAddr will contain address of this instruction
let notGreaterThanChunkEndJumpAddr = ProcedureOffset + calculateInstructionsLength(AllocationProc);
AllocationProc.push("GTO #allocate_global_check_block");  // notGreaterThanChunkEndJumpAddr will contain address of this instruction
AllocationProc = AllocationProc.concat(
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
        // Convert the exponent to the actual number of needed blocks (this is done now, although the result isn't needed until later, as it will be needed in both outcomes of the next branch)
    ],
    // Copy size needed from ps0 (NOTE: THIS MUST BE CHANGED, OTHER PROCEDURES ALSO USE PS0!) to ps0 so Base2Exp can use it
    copy(Addresses.ps0, Addresses.ps0, 1),
    // Write return address to psReturnAddr for Base2Exp to jump to after
);
AllocationProc = AllocationProc.concat(
    writeMultiByte(ProcedureOffset + calculateInstructionsLength(AllocationProc) + calculateInstructionsLength("GTO #base2Exponent"), Addresses.psReturnAddr, 4),
    [
        "GTO #base2Exponent",
        "AND 0",  // base2Exponent should jump back to here, and ps0 should now contain the full number of bytes requested
        // Check if the current block is exactly the right size

        `RED A ${blockStart}`,
        `SUB A ${Addresses.ps0}`,  // NEEDS TO BE CHANGED FROM ps0
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
    // NOTE: USE SOMETHING ELSE FOR BLOCKSTART TO FREE UP PS4
    copy(Addresses.ps3, Addresses.ps4, 4)
);
AllocationProc = AllocationProc.concat(
    add32BitIntegers(blockStart, Addresses.ps0, ProcedureOffset + calculateInstructionsLength(AllocationProc)),
    checkEqual(Addresses.ps3, Addresses.ps4, "#allocate_global_block_found_whole_chunk", "allocate_global_block_found_not_whole_chunk"),
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
    copy(chunkStart, Addresses.psAddr)
);
AllocationProc = AllocationProc.concat(
    incrementAddress(ProcedureOffset + calculateInstructionsLength(AllocationProc))
);
AllocationProc = AllocationProc.concat(
    copyToAddress(Addresses.ps4, 8, ProcedureOffset + calculateInstructionsLength(AllocationProc)),  // The pointers in the old chunk now contain the start and end addresses of the new one
    [
        "#allocate_global_all_chunks_searched AND 0",
        // All chunks have been searched, and no perfectly sized block has been found so split the smallest block in half and repeat until it is the right size
    ],
    // First check if smallestFound is 0, as this would mean there are no blocks large enough
    checkZero(smallestFound, 4, "#allocate_insufficient_space", "#allocate_global_split_block"),
    [
        `#allocate_global_split_block RED A ${smallestFound}`,
        `SUB A ${Addresses.ps0}`,  // CHANGE PS0 TO WHATEVER CONTAINS THE SIZE REQUESTED
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
    writeMultiByte(ProcedureOffset + calculateInstructionsLength(AllocationProc) + calculateInstructionsLength(["GTO #base2Exponent"]), Addresses.psReturnAddr, 4),
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
    



