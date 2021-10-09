/*
    Abstract class for table structure classes (variable tables, prototype tables, etc...)
*/
class Table{
    // Number of bytes used by the headers of the table
    _headersLength;
    // Number of bytes used by an entry in the table
    _entryLength;
    
    // Number of slots the table has
    _totalSlots = Math.floor((runtime_options.VariableTableSize - (this._headersLength + 4)) / this._entryLength)  // Subtract _headersLength + 4 so the space used for the headers and the pointer at the end of the table to the next expansion table are not taken into account
    // Allocate the memory for a new table in the current scope, and then create the table
    static create(instructionsLength, parentAddress=false){};
    // Allocate the memory for and create an extension table to provide extra space when existing tables become full
    static createExtension(instructionsLength){};

    // Set the name length field of each slot in the table to 0.  This is needed as searching uses the name length to avoid searching empty slots, so must run this after space is allocated to ensure no previously deallocated data causes searching to think empty slots are full
    static _clearNameLengthFields(instructionsLength){
        // Requires that ps0 contains a pointer to the allocated space

        // Add headerLength to skip past the headers straight to the first slot, and + 1 to go to the name length field
        let instructs = add32BitIntegers(Addresses.ps0, this._headersLength + 1, instructionsLength, false, true);
        // Use first byte of ps4 as a counter, to know when we have cleared each entry
        instructs = instructs.concat(
            [
                "AND 0",
                `ADD ${this._totalSlots}`,
                `WRT ${Addresses.ps4}`
            ]
        );
        let clearSlot = instructionsLength + calculateInstructionsLength(instructs);  // Address to jump to to clear slot pointed to by ps3
        let endOfProcAddr = clearSlot + 24 + calculateInstructionsLength(add32BitIntegers(Addresses.ps3, this._entryLength, 0, false, true).concat(["GTO 5"]));  // Address to jump to when all slots have been cleared
        instructs = instructs.concat(
            [
                "AND 0",
                `WRT A ${Addresses.ps3}`,
                `RED ${Addresses.ps4}`,
                "SUB 1",
                // Each slot has been cleared, so jump to end of procedure
                `BIZ ${endOfProcAddr}`,
                // There are still slots to clear
                `WRT ${Addresses.ps4}`
            ]
        );
        instructs = instructs.concat(
            add32BitIntegers(Addresses.ps3, this._entryLength, instructionsLength + calculateInstructionsLength(instructs), false, true),
            [
                `GTO ${clearSlot}`
            ]
        );
    }
}