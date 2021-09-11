Local Allocation:
- Resizing a chunk when one too large is found
	- Have all relevant pointers (previous chunk's start pointer, StackPointer and LastChunkStartPtr if the chunk was the last one) been made to point to the smaller chunk?
	- Has the size been recaluclated correctly?

- Test with different heap sizes and memory sizes
