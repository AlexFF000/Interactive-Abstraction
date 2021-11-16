/*
    Methods for generating code for managing name pools
*/
class NamePool{
    static _headersLength = 7;  // Length of headers in parent pool
    static _blockSize = 5;
    static _parentTotalBlocks = Math.floor(((runtime_options.NamePool - this._headersLength) - 4) / 5);  // Total number of blocks in a parent pool
    static _expansionTotalBlocks = Math.floor(((runtime_options.NamePoolSize - 1) - 4) / 5);  // Total number of blocks in an expansion pool  // Expansion pools have only 1 byte headers

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

    static createExpansion(instructionsLength, forceGlobal=false){ 
        // Return instructions to allocate and create a new name pool in the current scope (or global scope if forceGlobal is true)
        let evalLayer = [0, 0, 0, 0, 0];
        if (forceGlobal) evalLayer[0] = 1;  // Set EvalTop[0] to 1 if the pool should be in the global scope
        let instructs = EvalStack.pushLiteral(evalLayer);
        let returnAddr = instructionsLength + calculateInstructionsLength(instructs.concat(writeMultiByte(instructionsLength, instructionsLength, 4)).push("GTO #expandPool"));
        return instructs.concat(writeMultiByte(returnAddr, Addresses.psReturnAddr, 4)
            .push("GTO #expandPool"));
    }
}