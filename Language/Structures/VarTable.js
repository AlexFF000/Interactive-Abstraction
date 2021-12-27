/*
    Methods for generating code for managing variable tables
*/
class VarTable extends Table{
    static _headersLength = 8;
    static _entryLength = 10;
    static _totalSlots = Math.floor((runtime_options.VariableTableSize - (this._headersLength + 4)) / this._entryLength)

    static create(instructionsLength, parentAddress=false){
        // Return instructions to create a variable table in the current scope (this function only handles creating new tables, not expansion tables)
        // If parentAddress contains a number, it will be used as the address for the parent entry.  Otherwise the address of the global variable table will be used
        if (typeof parentAddress != "number") parentAddress = Addresses.GlobalArea + Offsets.frame.VariableTable;
        // First need to allocate the space for the table
        let instructs = allocateMemory(Math.log2(runtime_options.VariableTableSize), instructionsLength);
        let tableAddressPointer = Addresses.ps0;  // Pointer to the start address of the space allocated for the table
        // Clear name length field of each slot to ensure no deallocated data is still there
        instructs = instructs.concat(this._clearNameLengthFields(instructionsLength + calculateInstructionsLength(instructs)));
        // Set up variable table in the allocated space
        // Calculate address of second entry, as this will be needed later (do it up here so ps1 - ps2 can be overwritten later)
        instructs = instructs.concat(
            add32BitIntegers(tableAddressPointer, this._headersLength + this._entryLength, instructionsLength + calculateInstructionsLength(instructs), false, true)
        )
    
        // Construct headers (Do this in registers then copy all the headers over to the allocated space)
        instructs.push(
            // Load type tag into first byte
            "AND 0",
            `ADD ${type_tags.var_table}`,
            `WRT ${Addresses.ps1}`,
            // Load table length (number of entries) into second-third bytes.  Set this to 1 as we will create a parent entry in the table
            "AND 0",
            `WRT ${Addresses.ps1 + 1}`,
            "ADD 1",
            `WRT ${Addresses.ps1 + 2}`,
            "AND 0",
            // Fourth byte holds the number of expansion tables (will be 0 as there aren't any yet)
            `WRT ${Addresses.ps1 + 3}`
        );
        instructs = instructs.concat(
            // Fifth - eighth bytes contain address of next free slot.  Point to second slot, as we will put the parent entry in the first
            copy(Addresses.ps3, Addresses.ps2, 4),  // We already calculated this earlier, so just move it from ps3 to ps2
            [
                // Set up parent entry in first slot (this is not part of headers, but makes sense to do this now)
                "AND 0",
                `ADD ${type_tags.var_table_entry}`,
                `WRT ${Addresses.ps3}`,
                // Set name length to 0, as the parent entry doesn't have a name
                "AND 0",
                `WRT ${Addresses.ps3 + 1}`,
                // Set name address to 0 (not necessary, but makes it clearer that there is no name)
                `WRT ${Addresses.ps3 + 2}`,
                `WRT ${Addresses.ps3 + 3}`,
                `WRT ${Addresses.ps4}`,
                `WRT ${Addresses.ps4 + 1}`
            ]
            // Write parentAddress
        );
        instructs = instructs.concat(
            writeMultiByte(parentAddress, Addresses.ps4 + 2, 4)
        );
        instructs.push(
            // Make sure the second slot's name length and address of next free slot contains 0
            `WRT ${Addresses.ps5 + 2}`,  // Address stored in third-sixth byte of free slots (where the name address would be if the slot wasn't empty.  Can't be stored in first two bytes as otherwise this slot might be misinterpreted as a non-empty slot when searching the table)
            `WRT ${Addresses.ps5 + 3}`,
            `WRT ${Addresses.ps6}`,
            `WRT ${Addresses.ps6 + 1}`,
            `WRT ${Addresses.ps6 + 2}`,
            `WRT ${Addresses.ps6 + 3}`,
        );
        instructs = instructs.concat(
            copy(tableAddressPointer, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            copyToAddress(Addresses.ps1, 24, instructionsLength + calculateInstructionsLength(instructs))
        );
        return instructs;
    }

    static createExtension(instructionsLength){};
}