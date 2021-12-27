/*
    Class for representing Names during compilation
*/
class Name{
    text;
    bytes = [];
    constructor(name){
        this.text = name;
        this.bytes = this.generateBytes(name);
    }

    generateBytes(text){
        // Generate a list of bytes representing the name, which can be loaded into memory
        let generatedBytes = [];
        // First byte should be type tag
        generatedBytes.push(type_tags.name);
        // Second byte should be the number of blocks needed in a name pool to store the name (just use null as placeholder for now, and work this out after the other bytes have been generated)
        generatedBytes.push(null);

        for (let c of text){
            generatedBytes.push(this.charToByte(c));
        }
        generatedBytes[1] = Math.ceil(generatedBytes.length / NamePool.blockSize);
        return generatedBytes;
    }

    charToByte(char){
        // Get 8 bit int representing character
        return char.charCodeAt(0);
    }
}