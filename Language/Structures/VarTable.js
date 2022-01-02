/*
    Methods for generating code for managing variable tables
*/
class VarTable extends Table{
    static _parentHeadersLength = 8;
    static _expansionHeadersLength = 1;
    static _entryLength = 10;
    static _parentTotalSlots = Math.floor((runtime_options.VariableTableSize - (this._parentHeadersLength + 4)) / this._entryLength);
    static _expansionTotalSlots = Math.floor((runtime_options.VariableTableSize - (this._expansionHeadersLength + 4)) / this._entryLength)

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
            add32BitIntegers(tableAddressPointer, this._parentHeadersLength + this._entryLength, instructionsLength + calculateInstructionsLength(instructs), false, true)
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
        
        // Make sure that the 2nd byte of the unused space between the last slot and "next expansion" footer does NOT contain 0.  Otherwise, the allocation procedure will mistake it for an empty slot
        instructs = instructs.concat(
            add32BitIntegers(tableAddressPointer, this._parentHeadersLength + (this._parentTotalSlots * this._entryLength) + 1, instructionsLength + calculateInstructionsLength(instructs), false, true),
            [
                `AND 0`,
                `ADD 1`,
                `WRT A ${Addresses.ps3}`
            ]
        );
        return instructs;
    }

    static createExpansion(instructionsLength){
        /* 
            Return instructions to create an expansion table for the variable table referenced on EvalTop
            EvalTop format:
                - EvalTop[0:3] = Address of parent table
                - EvalTop[4] = Must be set to 1 if the parent table is in global scope, 0 otherwise
        */
        let parentTable = Addresses.ps16;
        let isGlobal = Addresses.ps17;  // Only 1 byte needed for this, but must be consecutive after parentTable.
        let lastTable = Addresses.ps17;  // isGlobal is no longer needed by the time lastTable is, so the same pseudoregister can be reused
        let expansionTable = Addresses.ps18;
        let generalCounter = Addresses.ps19;  // Only first byte is needed

        let instructs = EvalStack.copyNFromTopLayer(parentTable, 5, 0, instructionsLength);
        // Check if table can have any more expansions
        instructs = instructs.concat(
            add32BitIntegers(parentTable, 3, instructionsLength + calculateInstructionsLength(instructs), false, true),  // Number of expansion pools is in 3rd byte of parentPool
            [
                `RED A ${Addresses.ps3}`,
                "SUB 255",
                `BIZ ${instructionsLength + calculateInstructionsLength(instructs) + calculateInstructionsLength(add32BitIntegers(parentTable, 3, 0, false, true).concat([`RED A 0`, `SUB 255`, `BIZ 0`, `GTO 0`]))}`,
                // Limit has not been reached, so jump over error code  TODO: UPDATE THIS BRANCH ADDRESS ONCE ERROR CODE IS WRITTEN
                `GTO ${instructionsLength + calculateInstructionsLength(instructs) + calculateInstructionsLength(add32BitIntegers(parentTable, 3, 0, false, true).concat([`RED A 0`, `SUB 255`, `BIZ 0`, `GTO 0`]))}`
            ]
        );
        // Max number of expansions already reached so throw error.  TODO: IMPLEMENT THIS WHEN ERROR HANDLING IS SET UP

        // Allocate space for the new expansion.  Can use the 3 unused bytes of isGlobal to construct the EvalTop arguments
        instructs.push(
            `AND 0`,
            `ADD ${Math.log2(runtime_options.VariableTableSize)}`,
            `WRT ${isGlobal + 1}`,
            `AND 0`,
            `ADD ${type_tags.expansion_var_table}`,
            `WRT ${isGlobal + 2}`,
            `RED ${isGlobal}`,
            `WRT ${isGlobal + 3}`,
        );
        instructs = instructs.concat(
            EvalStack.copyNToTopLayer(isGlobal + 1, 3, 0, instructionsLength + calculateInstructionsLength(instructs))
        );
        instructs = instructs.concat(
            writeMultiByte(instructionsLength + calculateInstructionsLength(instructs.concat(writeMultiByte(instructionsLength, 0, 4), ["GTO #allocate"])), Addresses.psReturnAddr, 4),  // psReturnAddr now contains the address of the instruction to return to after allocating the space
            [
                "GTO #allocate"
            ]
        );
        // EvalTop now contains the address of the allocated space
        instructs = instructs.concat(
            EvalStack.copyNFromTopLayer(expansionTable, 4, 0, instructionsLength + calculateInstructionsLength(instructs)),  // expansionTable now contains the address of the space allocated for the new expansion table
            // The only header for expansion tables is the type tag, so write this
            [
                "AND 0",
                `ADD ${type_tags.expansion_var_table}`,
                `WRT A ${expansionTable}`
            ]
        );
        // Clear name lengths in expansionTable
        instructs = instructs.concat(
            this._clearNameLengthFields(instructionsLength + calculateInstructionsLength(instructs), true)
        );
        /*
            Link the last table to the new one by
                a) Finding the last table
                b) Writing the address of the new table in the "next expansion pointer" footer of the last table
                c) Incrementing the "number of expansions" header in the parent table
                d) Pointing the "next free slot pointer" header in the parent table to the first slot in the new table 
        */
        // a) Iterate through the tables to find the last one
        let lastTableFoundJumpAddr = instructionsLength + calculateInstructionsLength(instructs) + 1009;
        instructs = instructs.concat(
            copy(parentTable, lastTable, 4)
        );
        instructs = instructs.concat(
            add32BitIntegers(parentTable, 3, instructionsLength + calculateInstructionsLength(instructs), false, true),  //ps3 now contains address of "number of expansions" header
            [
                `RED A ${Addresses.ps3}`,
                "ADD 0",
                `BIZ ${lastTableFoundJumpAddr}`,  // The parent table is the last table
                `WRT ${generalCounter}`
            ] 
        );
        let checkForLastTableJumpAddr = instructionsLength + calculateInstructionsLength(instructs);
        instructs = instructs.concat(
            add32BitIntegers(lastTable, runtime_options.VariableTableSize - 4, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.psAddr, 4),  // psAddr now contains address of current tables "next table pointer" footer
        );
        instructs = instructs.concat(
            copyFromAddress(lastTable, 4, instructionsLength + calculateInstructionsLength(instructs)),  // lastTable now contains address of the next table
            [
                // Decrement counter to see if this is the last expansion
                `RED ${generalCounter}`,
                "SUB 1",
                `BIZ ${lastTableFoundJumpAddr}`,  // This is the last table
                `WRT ${generalCounter}`,  // This is not the last table, so save the decremented counter and check the next table
                `GTO ${checkForLastTableJumpAddr}`
            ]
        );
        // b) Write address of new table to "next expansion" footer of last one
        instructs = instructs.concat(
            add32BitIntegers(lastTable, runtime_options.VariableTableSize - 4, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.psAddr, 4)
        );
        instructs = instructs.concat(
            copyToAddress(expansionTable, 4, instructionsLength + calculateInstructionsLength(instructs))
        );
        // c) Increment "number of expansions" header
        instructs = instructs.concat(
            add32BitIntegers(parentTable, 3, instructionsLength + calculateInstructionsLength(instructs), false, true),  // ps3 now contains address of the header
            [
                `RED A ${Addresses.ps3}`,
                "ADD 1",
                `WRT A ${Addresses.ps3}`
            ]
        );
        // d) Point "Next free slot pointer" header to the first slot in the new table
        instructs = instructs.concat(
            add32BitIntegers(parentTable, 4, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.psAddr, 4),  // psAddr now contains address of header
        );
        instructs = instructs.concat(
            add32BitIntegers(expansionTable, 1, instructionsLength + calculateInstructionsLength(instructs), false, true),  // ps3 now contains address of first slot in new table
        );
        instructs = instructs.concat(
            copyToAddress(Addresses.ps3, 4, instructionsLength + calculateInstructionsLength(instructs))
        );

        // Make sure that the 2nd byte of the unused space between the last slot and "next expansion" footer does NOT contain 0.  Otherwise, the allocation procedure will mistake it for an empty slot
        instructs = instructs.concat(
            add32BitIntegers(expansionTable, this._expansionHeadersLength + (this._expansionTotalSlots * this._entryLength) + 1, instructionsLength + calculateInstructionsLength(instructs), false, true),
            [
                `AND 0`,
                `ADD 1`,
                `WRT A ${Addresses.ps3}`
            ]
        );
        // Place address of parent table back on EvalTop. No need to include the global flag as we know no more memory allocation will be needed for the current addEntry operation
        instructs = instructs.concat(
            EvalStack.copyNToTopLayer(parentTable, 4, 0, instructionsLength + calculateInstructionsLength(instructs)),
        );
        return instructs;
    }

    static addEntry(instructionsLength){
        /*
            Add new entry to the table, using details specified on EvalTop and EvalTop - 1:
                - EvalTop[0] = Name length (total bytes used by the name, not total blocks)
                - EvalTop[1:4] = Address of name
                - EvalTop - 1[0] = forceGlobal.  Set to 1 to force the entry to be added to global VarTable
        */
        let nameAddress = Addresses.ps8;
        let otherDetails = Addresses.ps9;  // Only 2 bytes of this needed.  1st byte will contain name length, 2nd will contain forceGlobal
        let tableAddress = Addresses.ps10;
        let constructEvalLayerReg = Addresses.ps11;  // Pseudoregister briefly needed for constructing EvalTop arguments
        let constructEvalLayerReg2 = Addresses.ps12;  // Another pseudoregister briefly needed for EvalTop args.  Must be consecutive after constructEvalLayerReg
        let slotAddr = Addresses.ps11;  // Can reuse ps11 as constructEvalLayerReg is no longer needed

        // Copy details from EvalStack into psuedoregisters
        let instructs = EvalStack.copyNFromTopLayer(otherDetails, 1, 0, instructionsLength);
        instructs = instructs.concat(
            EvalStack.copyNFromTopLayer(nameAddress, 4, 1, instructionsLength + calculateInstructionsLength(instructs)),
        );
        instructs = instructs.concat(
            EvalStack.removeLayer(instructionsLength + calculateInstructionsLength(instructs)),
        );
        instructs = instructs.concat(
            EvalStack.copyNFromTopLayer(otherDetails + 1, 1, 0, instructionsLength + calculateInstructionsLength(instructs))
        );
        
        // Find the correct VarTable
        instructs.push(
            `RED ${otherDetails + 1}`,
            "ADD 0",
            `BIZ ${instructionsLength + calculateInstructionsLength(instructs) + calculateInstructionsLength([`RED A 0`, `ADD 0`, `BIZ 0`].concat(copy(Addresses.GlobalArea + Offsets.frame.VarTablePointer, tableAddress, 4), [`GTO 0`]))}`,
        );
        // Use global VarTable
        instructs = instructs.concat(
            copy(Addresses.GlobalArea + Offsets.frame.VarTablePointer, tableAddress, 4),  // tableAddress now contains address of global VarTable
        );
        instructs.push(`GTO ${instructionsLength + calculateInstructionsLength(instructs) + calculateInstructionsLength(add32BitIntegers(Addresses.ScopePointer, Offsets.frame.VarTablePointer, 0, false, true).concat([`GTO 0`], copy(Addresses.ps3, Addresses.psAddr, 4), copyFromAddress(0, 4, 0)))}`)
        // Use VarTable of current scope
        instructs = instructs.concat(
            add32BitIntegers(Addresses.ScopePointer, Offsets.frame.VarTablePointer, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.psAddr, 4),
        );
        instructs = instructs.concat(
            copyFromAddress(tableAddress, 4, instructionsLength + calculateInstructionsLength(instructs))  // tableAddress now contains address of current scope's VarTable
        );

        // Allocate slot for the new entry
        instructs = instructs.concat(
            copy(tableAddress, constructEvalLayerReg, 4),
            copy(otherDetails + 1, constructEvalLayerReg2, 1),
        );
        instructs = instructs.concat(
            EvalStack.copyToTopLayer(constructEvalLayerReg, instructionsLength + calculateInstructionsLength(instructs))
        );
        instructs = instructs.concat(
            this._allocateSlot(instructionsLength + calculateInstructionsLength(instructs))
        );

        // Write details to new slot
        instructs = instructs.concat(
            EvalStack.copyNFromTopLayer(slotAddr, 4, 0, instructionsLength + calculateInstructionsLength(instructs)),  // slotAddr now contains address of the allocated slot
            copy(slotAddr, Addresses.psAddr, 4),
            // Write type tag
            [
                "AND 0",
                `ADD ${type_tags.var_table_entry}`,
                `WRT A ${Addresses.psAddr}`
            ]
        );
        // Write name length
        instructs = instructs.concat(
            incrementAddress(instructionsLength + calculateInstructionsLength(instructs)),
        );
        instructs = instructs.concat(
            copyToAddress(otherDetails, 1, instructionsLength + calculateInstructionsLength(instructs))
        );
        // Write name address
        instructs = instructs.concat(
            incrementAddress(instructionsLength + calculateInstructionsLength(instructs))
        );
        instructs = instructs.concat(
            copyToAddress(nameAddress, 4, instructionsLength + calculateInstructionsLength(instructs))
        );
        // Write null to data address, as nothing has been assigned to the variable yet
        instructs = instructs.concat(
            incrementAddress(instructionsLength + calculateInstructionsLength(instructs)),
            writeMultiByte(Addresses.NullAddress, nameAddress, 4),  // Need a pseudoregister to write it to and then copy it from.  nameAddress can be used as it isn't needed again
        );
        instructs = instructs.concat(
            copyToAddress(nameAddress, 4, instructionsLength + calculateInstructionsLength(instructs))
        );
        
        // The address of allocated slot should not be removed from EvalTop, as this avoids searching the table if this variable declaration is part of an assignment
        return instructs;
    }
}