/*
    Methods for generating code for managing variable tables
*/
class VarTable extends Table{
    _headersLength = 6;
    _entryLength = 10;

    static create(instructionsLength, parentAddress=false){
        // Return instructions to create a variable table in the current scope (this function only handles creating new tables, not expansion tables)
        // If parentAddress contains a number, it will be used as the address for the parent entry.  Otherwise the address of the global variable table will be used
        if (typeof parentAddress != "number") parentAddress = Addresses.GlobalArea + Offsets.frame.VariableTable;
        // First need to allocate the space for the table
        let instructs = allocateMemory(Math.log2(runtime_options.VariableTableSize), instructionsLength);
        let tableAddressPointer = Addresses.ps0;  // Pointer to the start address of the space allocated for the table
        // Clear name length field of each slot to ensure no deallocated data is still there
        this._clearNameLengthFields(instructionsLength + calculateInstructionsLength(instructs));
        // Set up variable table in the allocated space
    
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
            `WRT ${Addresses.ps1 + 3}`,
            // Fifth-sixth bytes contain index of next free slot (these start from 1 to allow 0 to indicate the table is full. Set to 2 to point to second slot, as we will put the parent entry in the first)
            `WRT ${Addresses.ps2}`,
            "ADD 2",
            `WRT ${Addresses.ps2 + 1}`,
            // Set up parent entry in first slot (this is not part of headers, but makes sense to do this now)
            "AND 0",
            `ADD ${type_tags.var_table_entry}`,
            `WRT ${Addresses.ps2 + 2}`,
            // Set name length to 0, as the parent entry doesn't have a name
            "AND 0",
            `WRT ${Addresses.ps2 + 3}`,
            // Write parentAddress
        );
        instructs = instructs.concat(
            writeMultiByte(parentAddress, Addresses.ps4, 4)
        )
        instructs.push(
            // Make sure the second slot's index of next free slot contains 0
            `WRT ${Addresses.ps5 + 2}`,  // Index stored in third-fourth byte of free slots (where the name address would be if the slot wasn't empty.  Can't be stored in first two bytes as otherwise this slot might be misinterpreted as a non-empty slot when searching the table)
            `WRT ${Addresses.ps5 + 3}`
        );
        instructs = instructs.concat(
            copy(tableAddressPointer, Addresses.psAddr, 4)
        );
        instructs.concat(
            copyToAddress(Addresses.ps1, 20, instructionsLength + calculateInstructionsLength(instructs))
        )
        return instructs;
    }

    static createExtension(instructionsLength){};
}