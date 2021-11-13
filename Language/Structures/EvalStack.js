/*
    Methods for generating code for managing evaluation stacks
*/

class EvalStack{
    
    static addLayer(instructionsLength){
        // Return instructions to add layer to current scope's eval stack (or raise error if there is not enough space)
        let instructs = [
            // Compare EvalSlotsUsed to EvalStackSize to check if there is any space left.  Raise error if not
            `RED ${Addresses.EvalSlotsUsed}`,
            `SUB ${runtime_options.EvalStackSize}`,
            // `BIZ EvalFullError`  // THIS NEEDS TO BE COMPLETED WHEN ERROR HANDLING IS SET UP
            // Increment EvalSlotsUsed
            `ADD ${runtime_options.EvalStackSize + 1}`,  // Better to just re-add EvalStackSize to get current value of EvalSlotsUsed, as addition is faster than loading from memory
            `WRT ${Addresses.EvalSlotsUsed}`
        ];
        // Increment EvalTop pointer by 5 to add another layer
        return instructs.concat(
            add32BitIntegers(Addresses.EvalTop, 5, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.EvalTop, 4)
        );
    }

    static removeLayer(instructionsLength){
        // Return instructions to remove the top layer
        let instructs = [
            // First decrement EvalSlotsUsed pointer
            `RED ${Addresses.EvalSlotsUsed}`,
            "SUB 1",
            // If the stack is already empty, then just end early.  No need to throw an error
            `BIN ${instructionsLength + 17 + calculateInstructionsLength(sub32BitInteger(1, 5, 0, false, true)) + calculateInstructionsLength(copy(1, 1, 4))}`,
            `WRT ${Addresses.EvalSlotsUsed}`,
        ];
        return instructs.concat(
            sub32BitInteger(Addresses.EvalTop, 5, instructionsLength + calculateInstructionsLength(instructs), false, true),
            copy(Addresses.ps3, Addresses.EvalTop, 4)
        );
    }
    
    static copyToNewLayer(srcAddress, instructionsLength){
        // Return instructions to add new layer to eval stack and copy 5 bytes starting from given address to it
        let instructs = this.addLayer(instructionsLength);
        return instructs.concat(this.copyToTopLayer(srcAddress, instructionsLength + calculateInstructionsLength(instructs)));
    }

    static pushLiteral(bytesSequence, instructionsLength){
        // Add new layer to Eval stack and write the given bytes to it
        let instructs = this.addLayer(instructionsLength);
        return instructs.concat(this.writeToTopLayer(bytesSequence, instructionsLength + calculateInstructionsLength(instructs)));
    }
    
    static copyToTopLayer(srcAddress, instructionsLength){
        // Copy 5 bytes starting from given address, to the top layer of current scope's eval stack
        let instructs = copy(Addresses.EvalTop, Addresses.psAddr, 4);
        return instructs.concat(copyToAddress(srcAddress, 5, instructionsLength + calculateInstructionsLength(instructs)));
    }
    
    static writeToTopLayer(bytesSequence, instructionsLength){
        // Write given bytes to the top layer on the Eval stack
        // Write bytes to ps2 and first byte of ps3
        let instructs = [
            "AND 0",
            `ADD ${bytesSequence[0]}`,
            `WRT ${Addresses.ps2}`,
            "AND 0",
            `ADD ${bytesSequence[1]}`,
            `WRT ${Addresses.ps2 + 1}`,
            "AND 0",
            `ADD ${bytesSequence[2]}`,
            `WRT ${Addresses.ps2 + 2}`,
            "AND 0",
            `ADD ${bytesSequence[3]}`,
            `WRT ${Addresses.ps2 + 3}`,
            "AND 0",
            `ADD ${bytesSequence[4]}`,
            `WRT ${Addresses.ps3}`
        ];
        return instructs.concat(this.copyToTopLayer(Addresses.ps2, instructionsLength + calculateInstructionsLength(instructs)));
    }

    static copyFromTopLayer(dstAddress, bytes, offset, instructionsLength){
        // Copy ${bytes} bytes starting from ${offset} from the top layer on the eval stack into ${dstAddress}
        let instructs = copy(Addresses.EvalTop, Addresses.psAddr, 4);
        for (let i = 0; i < offset; i++){
            instructs = instructs.concat(incrementAddress(instructionsLength + calculateInstructionsLength(instructs)));
        }
        return instructs.concat(copyFromAddress(dstAddress, bytes, instructionsLength + calculateInstructionsLength(instructs)));
    }
}