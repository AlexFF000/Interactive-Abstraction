/*
    Defines instructions for common procedures that will be used repeatedly (e.g. LOAD, ALLOCATE)
    These are simply be added to the start of the program, and then accessed using GTO when necessary
    This is far more memory efficient than having a copy of the same procedure whenever it is used

    When done, they jump to the address in psAddr
*/

/*
    Procedure for allocating memory
    The details about how much to allocate and where from are provided in the top entry on EvalStack:
        - EvalTop[0] = Amount of space needed (as a power of 2)
        - EvalTop[1] = The type tag of the object that the allocation is for (used to know whether the int/float pool can be used)
        - EvalTop[2] = Set to 1 to force the space to be allocated globally (i.e. on the heap or int/float pool).  If the DeclareGlobal flag is set it will be allocated globally regardless of whether this is set

    Upon completion, the first address of the newly allocated space is placed in the first 4 bytes of EvalTop
*/
const AllocationProc = [
    "#allocate: "
];