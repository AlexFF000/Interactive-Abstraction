/*
    Methods for generating code for managing name pools
*/
class NamePool{
    static _headersLength = 7;  // Length of headers in parent pool
    static _parentTotalBlocks = Math.floor(((runtime_options.NamePoolSize - this._headersLength) - 4) / 5);  // Total number of blocks in a parent pool
    static _expansionTotalBlocks = Math.floor(((runtime_options.NamePoolSize - 1) - 4) / 5);  // Total number of blocks in an expansion pool  // Expansion pools have only 1 byte headers
    static blockSize = 5;  // Must not be less than 5, as the details of next free chunk take up 5 bytes
    static maxNameSize = 51;  // The maximum number of blocks a name can request.  A hard limit is needed as AllocateNameProc some places use a single byte for name lengths.  These places include variable tables (which use a single byte for name length (in bytes) giving a maximum name size of 255), AllocateNameProc (which stores the total number of bytes to allocate in a single byte).  In addition, the total number of blocks allocated cannot be more than the total number of blocks in a pool

    static create(instructionsLength){
        // Return instructions to create a new name pool in the current scope (this function only handles creating new pools, not expansion pools)
        let poolAddressPointer = Addresses.ps0;  // Pointer to the start address of the space allocated for the pool
        // First need to allocate space for the pool
        let instructs = allocateMemory(Math.log2(runtime_options.NamePoolSize), instructionsLength, 0, false, true, poolAddressPointer);
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
            `ADD ${this._parentTotalBlocks}`,
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
        let instructs = EvalStack.pushLiteral(evalLayer, instructionsLength);
        let returnAddr = instructionsLength + calculateInstructionsLength(instructs.concat(writeMultiByte(instructionsLength, instructionsLength, 4), ["GTO #expandPool"]));
        return instructs.concat(
            writeMultiByte(returnAddr, Addresses.psReturnAddr, 4),
            [
               "GTO #expandPool"
            ]
        );
    }

    static storeName(instructionsLength, name, forceGlobal=false){
        // Create a name and store it on the name pool.  If forceGlobal=true then the global name pool will be used, else the current scope's one will be used
        // name should be a Name object
        // First allocate the space for the name
        let blocksNeeded = Math.ceil(name.bytes.length / this.blockSize);
        let instructs = EvalStack.pushLiteral(generateByteSequence([blocksNeeded, Number(forceGlobal)], 5), instructionsLength);
        instructs = instructs.concat(writeMultiByte(instructionsLength + calculateInstructionsLength(instructs.concat(writeMultiByte(instructionsLength, Addresses.psReturnAddr, 4), ["GTO #allocateName"])), Addresses.psReturnAddr, 4));
        instructs.push("GTO #allocateName");
        instructs = instructs.concat(
            // Do not remove the top layer after this, as the address of the name might still be useful
            EvalStack.copyNFromTopLayer(Addresses.ps3, 4, 0, instructionsLength + calculateInstructionsLength(instructs)),
            copy(Addresses.ps3, Addresses.psAddr, 4)
        );
        // Load the name into the allocated space
        for (let b of name.bytes){
            instructs = instructs.concat(
                [
                    "AND 0",
                    `ADD ${b}`,
                    `WRT A ${Addresses.psAddr}`,
                ]
            );
            instructs = instructs.concat(
                incrementAddress(instructionsLength + calculateInstructionsLength(instructs))
            );
        }
        return instructs;
    }
}