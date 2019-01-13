# toy-jvm
Toy implementation of JVM in JavaScript (NodeJS)

## Current Limitations:
- Dynamic Stack (as large as Node allows)
- 32-bit Integer support only
- Single thread
- No Heap Implemented beyond "Method Area"; so no GC either
  - No "new"
  - No method calls
- No Native Stacks
- No Exceptions
- Cannot load JDK class libraries
  - Self implementation of print/println, string and integer only (no string builder)
- Opcodes Implemented: 55 / 203

## Usage
```
npm install

node toy-jvm.js [class filenames] [classname of public static main]
```