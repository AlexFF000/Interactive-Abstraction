/*
    Methods for generating code for managing name pools
*/
class NamePool{
    static _headersLength = 7;
    static _blockSize = 5;
    static _parentTotalBlocks;  // Total number of blocks in a parent pool
    static _expansionTotalBlocks;  // Total number of blocks in an expansion pool

    static create(instructionsLength){
        // Return instructions to create a new name pool in the current scope (this function only handles creating new pools, not expansion pools)
        // First need to allocate space for the pool
        let instructs = allocateMemory(Math.log2(runtime_options.NamePoolSize), instructionsLength);
        let poolAddressPointer = Addresses.ps0;  // Pointer to the start address of the space allocated for the pool
        // Construct headers in pseudo-registers, then copy to pool all at once
        instructs.push(
            // Load type tag into first byte
            "AND 0",
            `ADD ${type_tags.name_pool}`,
            `WRT ${Addresses.ps4}`,
            // Write address of first free chunk (this will be the first address after the headers) into 2nd to 5th bytes
        );
        instructs = instructs.concat(
            add32BitIntegers(poolAddressPointer, this._headersLength, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.ps4 + 1, 4)
        );
        instructs.push(
            // Load the number of blocks in the first free space into the 6th byte
            "AND 0",
            `ADD ${Math.floor((runtime_options.NamePoolSize - this._headersLength) / this._blockSize)}`,
            `WRT ${Addresses.ps5 + 1}`,
            // Load the number of expansion pools into the 7th byte (there are none yet, so this will be 0)
            "AND 0",
            `WRT ${Addresses.ps5 + 2}`
        );
        // Also make sure the first free chunk's pointer to the next free chunk is clear, as it is the only free chunk
        instructs = instructs.concat(
            writeMultiByte(0, Addresses.ps5 + 3, 4),
            // Also set its field for the number of blocks in the next free chunk to 0
            [
                "AND 0",
                `WRT ${Addresses.ps6 + 3}`
            ]
        )
        // Copy headers to the pool
        instructs = instructs.concat(
            copy(poolAddressPointer, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            copyToAddress(Addresses.ps4, 12, instructionsLength + calculateInstructionsLength(instructs))
        )
        return instructs;
    }

    static createExpansion(instructionsLength){
        /* 
            Return instructions to allocate and create a new name pool in the current scope
            Details should be provided on EvalStack:
                - EvalTop[0] = Set to 1 to add the pool to the global scope
            Leaves the details of the new pool in EvalTop:
                - EvalTop[0:3] = The address of the new expansion pool
        */
        let parentPoolPointer = Addresses.ps4;  // Holds the address of the parent pool for the scope
        let newPoolPointer = Addresses.ps5;  // Holds address of the new pool
        let existingExpansionPools = Addresses.ps6;  // Number of existing expansion pools.  Only need 1 byte for this
        let generalCounter = Addresses.ps6 + 1;  // A counter for the loop for finding the last pool.  Only need 1 byte for this
        let generalPointer = Addresses.ps7;
        // Get the address of the parent pool
        let instructs = [
            `RED A ${Addresses.EvalTop}`,
            "ADD 0",
            "BIZ #expandPool_currentScope",
        ].concat(
            // Else load global parent name pool address into parentPoolPointer
            copy(Addresses.GlobalArea + Offsets.frame.NamePoolPointer, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            copyFromAddress(parentPoolPointer, 4, instructionsLength + calculateInstructionsLength(instructs)),
            [
                "GTO #expandPool_checkExpansionLimit",
                // Load current scope's name pool address into parentPoolPointer
                "#expandPool_currentScope AND 0",
            ]
        );
        instructs = instructs.concat(
            add32BitIntegers(Addresses.ScopePointer, Offsets.frame.NamePoolPointer, instructionsLength + calculateInstructionsLength(instructs), true, true),
            copy(Addresses.ps3, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            copyFromAddress(parentPoolPointer, 4, instructionsLength + calculateInstructionsLength(instructs)), // parentPoolPointer now contains the address of the parent name pool for this scope
            [
                "#expandPool_checkExpansionLimit AND 0"
            ]
        );
        // Check to make sure we haven't already reached the max number of expansion pools in this scope
        instructs = instructs.concat(
            add32BitIntegers(parentPoolPointer, 6, instructionsLength + calculateInstructionsLength(instructs), false, true),  // ps3 now contains address of the "number of expansion pools" header
            [
                `RED A ${Addresses.ps3}`,
                `WRT ${existingExpansionPools}`,
                "SUB 255",
                `BIZ #expandPool_tooManyExpansions`  // We can't add any more expansion pools. ERROR: TOO MANY NAME POOLS. NEED TO DO THIS WHEN ERROR HANDLING IS SET UP
            ]
        );
        // Allocate enough space for the pool
        instructs = instructs.concat(
            [
                `RED A ${Addresses.EvalTop}`,
                "ADD 0",
                "BIZ #expandPool_allocateLocal"
            ]
        );
        // Allocate space for the pool globally
        instructs.concat(
            allocateMemory(Math.log2(runtime_options.NamePoolSize), instructionsLength + calculateInstructionsLength(instructs), 0, true, true, newPoolPointer),
            [
                "GTO #expandPool_createHeader",
                // Allocate space for the pool in the current scope
                "#expandPool_allocateLocal AND 0",
            ]
        );
        instructs = instructs.concat(
            allocateMemory(Math.log2(runtime_options.NamePoolSize), instructionsLength + calculateInstructionsLength(instructs), 0, false, true, newPoolPointer),
            [
                "#expandPool_createHeader AND 0"
                // The only header for expansion pools is the type tag
                `ADD ${type_tags.expansion_name_pool}`,
                `WRT A ${newPoolPointer}`,
            ]
        );
        /*
            Link the old pool to the new one.
            Do this by:
                a) Finding the last pool
                b) Writing the address of the new pool to the "next expansion" footer of the last pool
                c) Incrementing the "number of expansion pools" header of the parent pool
                d) Copying the existing "next free chunk" headers from the parent pool to the chunk in the new pool, and replacing them with the new chunk's details
        */
        // a) Find the last pool
        instructs = instructs.concat(
            copy(parentPoolPointer, generalPointer, 4),
            [
                // If there are 0 expansion pools, then the last pool is the parent one
                `RED ${existingExpansionPools}`,
                `WRT ${generalCounter}`,
                "ADD 0",
                "BIZ #expandPool_lastPoolFound",

                "#expandPool_checkForLastPool AND 0",
            ],
            add32BitIntegers(generalPointer, runtime_options.NamePoolSize - 4, instructionsLength + calculateInstructionsLength(instructs), false, true),  // ps3 now contains address of the current pool's pointer to the next pool
            copy(Addresses.ps3, Addresses.psAddr, 4),
        );
        instructs = instructs.concat(
            copyFromAddress(generalPointer, 4, instructionsLength + calculateInstructionsLength(instructs)),  // generalPointer now contains address of the next pool
            [
                `RED ${generalCounter}`,
                "SUB 1",
                "BIZ #expandPool_lastPoolFound",
                `WRT ${generalCounter}`,
                "GTO #expandPool_checkForLastPool",

                "#expandPool_lastPoolFound AND 0",  // generalPointer now contains the address of the last pool
            ],
        );
        // b) Write the address of the new pool to the footer of the last pool
        instructs = instructs.concat(
            add32BitIntegers(generalPointer, runtime_options.NamePoolSize - 4, instructionsLength + calculateInstructionsLength(instructs)),
            copy(Addresses.ps3, Addresses.psAddr, 4),
        );
        instructs = instructs.concat(
            copyToAddress(newPoolPointer, 4, instructionsLength + calculateInstructionsLength(instructs)),  // "Next pool" footer of the last pool now contains the address of the new pool
        );
        // c) Increment the "number of expansion pools header"
        instructs = instructs.concat(
            add32BitIntegers(parentPoolPointer, 6, instructionsLength + calculateInstructionsLength(instructs), false, true),  // ps3 now contains address of the "number of expansion pools" header
            [
                `RED ${existingExpansionPools}`,
                "ADD 1",
                `WRT ${Addresses.ps3}`
            ]
        );
        // d) Copy the existing next free chunk details to the chunk in the new pool, and replace them with the details of the new chunk
        instructs = instructs.concat(
            add32BitIntegers(parentPoolPointer, 1, instructionsLength + calculateInstructionsLength(instructs), false, true),  // ps3 now contains address of the "next free space" header
            copy(Addresses.ps3, Addresses.psAddr, 4),
        );
        instructs = instructs.concat(
            copyFromAddress(generalPointer, 4, instructionsLength + calculateInstructionsLength(instructs)), // generalPointer now contains the "next free chunk" header
        );
        instructs = instructs.concat(
            copyFromAddress(generalCounter, 1, instructionsLength + calculateInstructionsLength(instructs)),  // generalCounter now contains the number of blocks in the first free chunk
        );
        instructs = instructs.concat(
            add32BitIntegers(newPoolPointer, 1, instructionsLength + calculateInstructionsLength(instructs), false, true),  // ps3 now contains the start address of the first chunk in the new pool
            copy(Addresses.ps3, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            copyToAddress(generalPointer, 4, instructionsLength + calculateInstructionsLength(instructs))  // The first 4 bytes of the chunk in the new pool now contain the existing first chunk pointer
        );
        instructs = instructs.concat(
            copyToAddress(generalCounter, 1, instructionsLength + calculateInstructionsLength(instructs))  // The 5th byte of the chunk in the new pool now contains the number of bytes in the existing first chunk
        );
        // Write new pool details to "next free chunk" header
        instructs = instructs.concat(
            add32BitIntegers(parentPoolPointer, 1, instructionsLength + calculateInstructionsLength(instructs), false, true),  // ps3 now contains the address of the "next free chunk" header
            copy(Addresses.ps3, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            add32BitIntegers(newPoolPointer, 1, instructionsLength + calculateInstructionsLength(instructs), false, true),  // ps3 now contains the start address of the first chunk in the new pool
        );
        instructs = instructs.concat(
            copyToAddress(Addresses.ps3, 4, instructionsLength + calculateInstructionsLength(instructs)),  // The "next chunk" header now contains the address of the new chunk
            [
                `AND 0`,
                `ADD ${NamePool._expansionTotalBlocks}`,
                `WRT A ${Addresses.psAddr}`,  // The "number of blocks in next chunk" header now contains the number of blocks in the new chunk
            ]
        )

    }
}