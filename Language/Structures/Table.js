/*
    Abstract class for table structure classes (variable tables, prototype tables, etc...)
*/
class Table{
    // Number of bytes used by the headers of the table
    static _parentHeadersLength;
    static _expansionHeadersLength;
    // Number of bytes used by an entry in the table
    static _entryLength;
    
    // Number of slots the table has
    static _parentTotalSlots = Math.floor((runtime_options.VariableTableSize - (this._parentHeadersLength + 4)) / this._entryLength);  // Subtract _headersLength + 4 so the space used for the headers and the pointer at the end of the table to the next expansion table are not taken into account
    static _expansionTotalSlots = Math.floor((runtime_options.VariableTableSize - (this._expansionHeadersLength + 4)) / this._entryLength);
    // Allocate the memory for a new table in the current scope, and then create the table
    static create(instructionsLength, parentAddress=false){};
    // Allocate the memory for and create an expansion table to provide extra space when existing tables become full
    static createExpansion(instructionsLength){};

    static _allocateSlot(instructionsLength){
        // Find and allocate the next free slot in the table referenced on EvalTop
        let table = Addresses.ps4;
        let nextFreeSlot = Addresses.ps5;
        let newNextFreeSlot = Addresses.ps6;
        let generalPointer = Addresses.ps7;

        let instructs = EvalStack.copyNFromTopLayer(table, 4, 0, instructionsLength);
        // Get first free slot address
        instructs = instructs.concat(
            add32BitIntegers(table, 4, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            copyFromAddress(nextFreeSlot, 4, instructionsLength + calculateInstructionsLength(instructs)),  // nextFreeSlot now contains the address of the next free slot
            // If nextFreeSlot contains 0 then there are no more free slots, so we need to create an expansion table
            checkZero(nextFreeSlot, 4, instructionsLength + calculateInstructionsLength(instructs) + calculateInstructionsLength(checkZero(nextFreeSlot, 4, 0, 0)), instructionsLength + calculateInstructionsLength(instructs) + calculateInstructionsLength(checkZero(nextFreeSlot, 4, 0, 0)) + calculateInstructionsLength(this.createExpansion(0).concat(`GTO ${instructionsLength}`)))
        );

        // nextFreeSlot is 0 so there are no more free slots, so create an expansion table
        instructs = instructs.concat(
            this.createExpansion(instructionsLength + calculateInstructionsLength(instructs)),
            [
                // After creating the new expansion, return to the start of this method and try again
                `GTO ${instructionsLength}`,
            ]
        );

        // nextFreeSlot is not 0, so there is a slot we can use
        /*
            Point "next free pointer" header to the new next free slot:
                - If this slot's "next free space" pointer is not 0, then just use the slot that it points to
                - If this slot's "next free space" pointer is 0, then use the next consecutive slot if it is not in use or outside the table
                    - If the pointer is 0 and the next consecutive slot is used or outside the table, then there are no more free slots
            
        */
        instructs = instructs.concat(
            add32BitIntegers(nextFreeSlot, 3, instructionsLength + calculateInstructionsLength(instructs), false, true),  // ps3 now contains the address of this slot's "next free slot pointer"
            copy(Addresses.ps3, Addresses.psAddr, 4),
        );
        instructs = instructs.concat(
            copyFromAddress(newNextFreeSlot, 4, instructionsLength + calculateInstructionsLength(instructs)),  // newNextFreeSlot now contains the value of "next free slot pointer" field
            checkZero(newNextFreeSlot, 4, instructionsLength + calculateInstructionsLength(instructs) + calculateInstructionsLength(copyFromAddress(0, 4, 0).concat(checkZero(newNextFreeSlot, 4, 0, 0))) + calculateInstructionsLength(add32BitIntegers(table, 4, 0, false, true).concat(copy(0, 0, 4), copyToAddress(newNextFreeSlot, 4, instructionsLength + calculateInstructionsLength(instructs)), ["GTO 0"])), instructionsLength + calculateInstructionsLength(instructs) + calculateInstructionsLength(copyFromAddress(0, 4, 0).concat(checkZero(newNextFreeSlot, 4, 0, 0))))
        );
        
        // newNextFreeSlot is not 0, so we can just write it to the "next free slot pointer" header
        instructs = instructs.concat(
            add32BitIntegers(table, 4, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            copyToAddress(newNextFreeSlot, 4, instructionsLength + calculateInstructionsLength(instructs)),  // The "next free slot pointer" header has now been updated
        );
        instructs.push(`GTO ${instructionsLength + calculateInstructionsLength(instructs) + 1764}`);  // Jump to code to increment "number of entries" header and place found slot address on EvalTop
        
        // newNextFreeSlot is 0, so we need to find out if we can use the next consecutive slot
        instructs = instructs.concat(
            add32BitIntegers(nextFreeSlot, this._entryLength, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, newNextFreeSlot, 4),  // newNextFreeSlot now contains the address of the next consecutive slot
            copy(Addresses.ps3, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            incrementAddress(instructionsLength + calculateInstructionsLength(instructs)), // psAddr now contains address of the next slot's "name length" field
        );
        instructs = instructs.concat(
            [
                `RED A ${Addresses.psAddr}`,
                `ADD 0`,
                `BIZ ${instructionsLength + calculateInstructionsLength(instructs) + calculateInstructionsLength([`RED A 0`, `ADD 0`, `BIZ 0`, `AND 0`, `WRT 0`, `WRT 0`, `WRT 0`, `WRT 0`].concat(add32BitIntegers(0, 4, 0, false, true), copy(0, 0, 4), copyToAddress(0, 4, 0), ["GTO 0"]))}`,  // The next consecutive space's name length is 0, so we can use it
                // Next consecutive space's name length is not 0, so it is either not a valid slot or is in use
                `AND 0`,
                `WRT ${newNextFreeSlot}`,
                `WRT ${newNextFreeSlot + 1}`,
                `WRT ${newNextFreeSlot + 2}`,
                `WRT ${newNextFreeSlot + 3}`,
            ]
        );
        
        instructs = instructs.concat(
            add32BitIntegers(table, 4, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.psAddr, 4),
        );
        instructs = instructs.concat(
            copyToAddress(newNextFreeSlot, 4, instructionsLength + calculateInstructionsLength(instructs))  // The "next free pointer" header now contains 0
        );
        instructs.push(`GTO ${instructionsLength + calculateInstructionsLength(instructs) + 627}`);  // Jump to code to increment "number of entries" header and place found slot address on EvalTop
        // Next consecutive slot's name length is 0, so we can use it
        instructs = instructs.concat(
            add32BitIntegers(table, 4, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.psAddr, 4),
        );
        instructs = instructs.concat(
            copyToAddress(newNextFreeSlot, 4, instructionsLength + calculateInstructionsLength(instructs))
        );

        // Increment "number of entries" header
        // The header is two bytes, so will be loaded into the last 2 bytes of generalPointer
        instructs = instructs.concat(
            add32BitIntegers(table, 1, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.psAddr, 4)  // psAddr now contains address of the header
        );
        instructs = instructs.concat(
            copyFromAddress(generalPointer + 2, 2, instructionsLength + calculateInstructionsLength(instructs)),
        );
        instructs = instructs.concat(
            add32BitIntegers(generalPointer, 1, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3 + 2, generalPointer + 2, 2)
        );
        instructs = instructs.concat(
            add32BitIntegers(table, 1, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.psAddr, 4),
        );
        instructs = instructs.concat(
            copyToAddress(generalPointer + 2, 2, instructionsLength + calculateInstructionsLength(instructs))
        );
        
        // Place address of found slot on EvalTop
        return instructs.concat(
            EvalStack.copyNToTopLayer(nextFreeSlot, 4, 0, instructionsLength + calculateInstructionsLength(instructs))
        );
    }

    // Set the name length field of each slot in the table to 0.  This is needed as searching uses the name length to avoid searching empty slots, so must run this after space is allocated to ensure no previously deallocated data causes searching to think empty slots are full
    static _clearNameLengthFields(instructionsLength, expansion=false){
        // Requires that ps0 contains a pointer to the allocated space
        if (expansion){
            var headersLength = this._expansionHeadersLength;
            var totalSlots = this._expansionTotalSlots;
        }
        else{
            var headersLength = this._parentHeadersLength;
            var totalSlots = this._parentTotalSlots;
        }

        // Add headerLength to skip past the headers straight to the first slot, and + 1 to go to the name length field
        let instructs = add32BitIntegers(Addresses.ps0, headersLength + 1, instructionsLength, false, true);
        // Use first byte of ps4 as a counter, to know when we have cleared each entry
        instructs = instructs.concat(
            [
                "AND 0",
                `ADD ${totalSlots}`,
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
        return instructs;
    }
}