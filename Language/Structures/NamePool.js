/*
    Methods for generating code for managing name pools
*/
class NamePool{
    static _headersLength = 7;
    static _blockSize = 5;

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
            `WRT ${Addresses.ps1}`,
            // Write address of first free chunk (this will be the first address after the headers) into 2nd to 5th bytes
        );
        instructs = instructs.concat(
            add32BitIntegers(poolAddressPointer, this._headersLength, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.ps1 + 1, 4)
        );
        instructs.push(
            // Load the number of blocks in the first free space into the 6th byte
            "AND 0",
            `ADD ${Math.floor(runtime_options.NamePoolSize - this._headersLength / this._blockSize)}`,
            `WRT ${Addresses.ps2 + 1}`,
            // Load the number of expansion pools into the 7th byte (there are none yet, so this will be 0)
            "AND 0",
            `WRT ${Addresses.ps2 + 2}`
        );
        // Also make sure the first free chunk's pointer to the next free chunk is clear, as it is the only free chunk
        instructs = instructs.concat(
            writeMultiByte(0, Addresses.ps2 + 3, 4),
            // Also set its field for the number of blocks in the next free chunk to 0
            [
                "AND 0",
                `WRT ${Addresses.ps3 + 3}`
            ]
        )
        // Copy headers to the pool
        instructs = instructs.concat(
            copy(poolAddressPointer, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            copyToAddress(Addresses.ps1, 12, instructionsLength + calculateInstructionsLength(instructs))
        )
        return instructs;
    }
}