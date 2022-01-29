/*
    Class for representing modifier flags during compilation

    Memory format:
    Consists of a single byte:
        - bit 7 (2^0) = static
        - bit 6 (2^1) = private
        - bit 5 (2^2) = public
*/
class Modifiers{
    global;  // The global flag is only used during compilation
    static;
    private;
    public;
    bytes;

    constructor(){
        this.global = false;
        this.static = false;
        this.private = false;
        this.public = false;
        this.generateBytes();
    }

    setGlobal(isSet){
        this.global = isSet;
        this.generateBytes();
    }

    setStatic(isSet){
        this.static = isSet;
        this.generateBytes();
    }

    setPrivate(isSet){
        this.private = isSet;
        this.generateBytes();
    }
    
    setPublic(isSet){
        this.public = isSet;
        this.generateBytes();
    }

    generateBytes(){
        // Generate flags byte
        let byte = 0;
        if (this.static) byte |= 1;
        if (this.private) byte |= 2;
        if (this.public) byte |= 4;
        this.bytes = [byte];
    }
}