// break this down into 2 pieces:
// class loader -> reads the classpath and parses the files for execution
// cpu -> scope (framestack), const pool, opcode interpreter

const fs = require("fs");
const term = require("terminal-kit").terminal;

// Global constants
const byte = 1, word = 2, dword = 4;

// Enums... replace later
const STRING_UTF8      = 1,
    INTEGER          = 3,
    FLOAT            = 4,
    LONG             = 5,
    DOUBLE           = 6,
    CLASS            = 7,
    STRING           = 8,
    FIELD            = 9,
    METHOD           = 10,
    INTERFACE_METHOD = 11,
    NAME             = 12,
    METHOD_HANDLE    = 15,
    METHOD_TYPE      = 16,
    INVOKE_DYNAMIC   = 18;
const ACC_PUBLIC = 0x0001, //Declared public; may be accessed from outside its package.
    ACC_PRIVATE = 0x0002, //Declared private; accessible only within the defining class.
    ACC_PROTECTED = 0x0004, //Declared protected; may be accessed within subclasses.
    ACC_STATIC = 0x0008, //Declared static.
    ACC_FINAL = 0x0010, //Declared final; must not be overridden (§5.4.5).
    ACC_SYNCHRONIZED = 0x0020, //Declared synchronized; invocation is wrapped by a monitor use.
    ACC_BRIDGE = 0x0040, //A bridge method, generated by the compiler.
    ACC_VARARGS = 0x0080, //Declared with variable number of arguments.
    ACC_NATIVE = 0x0100, //Declared native; implemented in a language other than Java.
    ACC_ABSTRACT = 0x0400, //Declared abstract; no implementation is provided.
    ACC_STRICT = 0x0800, //Declared strictfp; floating-point mode is FPstrict.
    ACC_SYNTHETIC = 0x1000; //Declared synthetic; not present in the source code.

class BuiltIn {
    constructor() {
        this.classes = [
            { 
                class: "java/io/PrintStream",
                methods: [
                    { method: "println", signatures: [
                        { 
                            signature: "(Ljava/lang/String;)V", op: (vm) => {
                                let i = vm.frameStack.stackPop();
                                let i1 = vm.frameStack.getConst(i).value.ref.class_idx;
                                let str = vm.frameStack.getConst(i1).value.string;
                                term(str);
                                term("\n");
                                //console.log(str);
                            }
                        },
                        {
                            signature: "(I)V", op: (vm) => {
                                let int = vm.frameStack.stackPop();
                                term(int);
                                term("\n");
                            }
                        }
                    ]
                    },
                    { method: "print", signatures: [
                        { 
                            signature: "(Ljava/lang/Object;)V", op: (vm) => {
                                let i = vm.frameStack.stackPop();
                                let i1 = vm.frameStack.getConst(i).value.ref.class_idx;
                                let objectRef = vm.frameStack.getConst(i1).value.string;
                                term(objectRef); // won't work, needs to run toString() method
                            }
                        },
                        {
                            signature: "(I)V", op: (vm) => {
                                let int = vm.frameStack.stackPop();
                                term(int);
                            }
                        }
                    ]
                    }
                ]
            },
            { 
                class: "java/lang/Object",
                methods: [
                    { method: "<init>", signatures: [
                        { 
                            signature: "()V", op: () => {} // default constructor for base Object type
                        },
                    ]
                    }
                ]
            },
        ];
        //this.method = [];
    }
    invoke(vm, className, methodName, signature) {
        let lib = this.classes.find(x => x.class === className);
        if(lib != null) {
            let method = lib.methods.find(x => x.method === methodName);
            if(method != null) {
                let inst = method.signatures.find(x => x.signature === signature);
                inst.op(vm);
            }
        }
    }
}

// TODO: Refactor
const Exec = {
    signed16: (high, low) => {
        return !(((high << 8) | low) & 0xA000) ? 
            (((high << 8) | low) >>> 0) :
            ((((high << 8) | low) >>> 0) | 0xFFFF0000);
    },
    xref: (op) => {
        let o = Exec.ops.find(x => x.op === op);
        if(o != null && o.fn == null) {
            o.fn = () => { term.red.bold(`Operation not implemented: ${op}\n`); };
        }
        return o;
    },
    translate: (vm, operation, params) => {
        if(operation != null) {
            if(operation.fn === null){
                term.red.bold(`Unimplemented OpCode: ${operation.mnemonic}\n`);
            } else {
                operation.fn.apply(null, [vm, ...params]);
            }
        } else {
            term.red.bold("Unsupported OpCode\n");
        }
    },
    implCount: () => {
        return Exec.ops.filter(x => x.fn != null).length;
    },
    ops: [
        { mnemonic: "nop", op: 0x0, len: 1, fn: () => {} },
        { mnemonic: "aconst_null", op: 0x1, len: 1, fn: (vm) => {
            vm.frameStack.stackPush(null);
        } },
        { mnemonic: "iconst_m1", op: 0x2, len: 1, fn: (vm) => {
            vm.frameStack.stackPush(-1);
        } },
        { mnemonic: "iconst_0", op: 0x3, len: 1, fn: (vm) => {
            vm.frameStack.stackPush(0);
        } },
        { mnemonic: "iconst_1", op: 0x4, len: 1, fn: (vm) => {
            vm.frameStack.stackPush(1);
        } },
        { mnemonic: "iconst_2", op: 0x5, len: 1, fn: (vm) => {
            vm.frameStack.stackPush(2);
        } },
        { mnemonic: "iconst_3", op: 0x6, len: 1, fn: (vm) => {
            vm.frameStack.stackPush(3);
        } },
        { mnemonic: "iconst_4", op: 0x7, len: 1, fn: (vm) => {
            vm.frameStack.stackPush(4);
        } },
        { mnemonic: "iconst_5", op: 0x8, len: 1, fn: (vm) => {
            vm.frameStack.stackPush(5);
        } },
        { mnemonic: "lconst_0", op: 0x9, len: 1, fn: (vm) => {
            vm.frameStack.stackPush(0);
            vm.frameStack.stackPush(0);
        } },
        { mnemonic: "lconst_1", op: 0x0a, len: 1, fn: (vm) => {
            vm.frameStack.stackPush(0);
            vm.frameStack.stackPush(1);
        } },
        { mnemonic: "fconst_0", op: 0x0b, len: 1, fn: null },
        { mnemonic: "fconst_1", op: 0x0c, len: 1, fn: null },
        { mnemonic: "fconst_2", op: 0x0d, len: 1, fn: null },
        { mnemonic: "dconst_0", op: 0x0e, len: 1, fn: null },
        { mnemonic: "dconst_1", op: 0x0f, len: 1, fn: null },
        { mnemonic: "bipush", op: 0x10, len: 2, fn: (vm, a) => {
            vm.frameStack.stackPush(a);
        } },
        { mnemonic: "sipush", op: 0x11, len: 3, fn: (vm, a,b) => {
            vm.frameStack.stackPush( ((a << 8) | b) >>> 0 );
        } },
        { mnemonic: "ldc", op: 0x12, len: 2, fn: (vm, a) => {
            vm.frameStack.stackPush(a);
        } },
        { mnemonic: "ldc_w", op: 0x13, len: 3, fn: null },
        { mnemonic: "ldc2_w", op: 0x14, len: 3, fn: null },
        { mnemonic: "iload", op: 0x15, len: 2, fn: (vm, a) => {
            let v = vm.frameStack.getLocalVar(a);
            vm.frameStack.stackPush(v);
        } },
        { mnemonic: "lload", op: 0x16, len: 2, fn: null },
        { mnemonic: "fload", op: 0x17, len: 2, fn: null },
        { mnemonic: "dload", op: 0x18, len: 2, fn: null },
        { mnemonic: "aload", op: 0x19, len: 2, fn: null },
        { mnemonic: "iload_0", op: 0x1a, len: 1, fn: (vm) => {
            let v = vm.frameStack.getLocalVar(0);
            vm.frameStack.stackPush(v);
        } },
        { mnemonic: "iload_1", op: 0x1b, len: 1, fn: (vm) => {
            let v = vm.frameStack.getLocalVar(1);
            vm.frameStack.stackPush(v);
        } },
        { mnemonic: "iload_2", op: 0x1c, len: 1, fn: (vm) => {
            let v = vm.frameStack.getLocalVar(2);
            vm.frameStack.stackPush(v);
        } },
        { mnemonic: "iload_3", op: 0x1d, len: 1, fn: (vm) => {
            let v = vm.frameStack.getLocalVar(3);
            vm.frameStack.stackPush(v);
        } },
        { mnemonic: "lload_0", op: 0x1e, len: 1, fn: null },
        { mnemonic: "lload_1", op: 0x1f, len: 1, fn: null },
        { mnemonic: "lload_2", op: 0x20, len: 1, fn: null },
        { mnemonic: "lload_3", op: 0x21, len: 1, fn: null },
        { mnemonic: "fload_0", op: 0x22, len: 1, fn: null },
        { mnemonic: "fload_1", op: 0x23, len: 1, fn: null },
        { mnemonic: "fload_2", op: 0x24, len: 1, fn: null },
        { mnemonic: "fload_3", op: 0x25, len: 1, fn: null },
        { mnemonic: "dload_0", op: 0x26, len: 1, fn: null },
        { mnemonic: "dload_1", op: 0x27, len: 1, fn: null },
        { mnemonic: "dload_2", op: 0x28, len: 1, fn: null },
        { mnemonic: "dload_3", op: 0x29, len: 1, fn: null },
        { mnemonic: "aload_0", op: 0x2a, len: 1, fn: (vm) => {
            let v = vm.frameStack.getLocalVar(0);
            vm.frameStack.stackPush(v);
        } },
        { mnemonic: "aload_1", op: 0x2b, len: 1, fn: (vm) => {
            let v = vm.frameStack.getLocalVar(1);
            vm.frameStack.stackPush(v);
        } },
        { mnemonic: "aload_2", op: 0x2c, len: 1, fn: (vm) => {
            let v = vm.frameStack.getLocalVar(2);
            vm.frameStack.stackPush(v);
        } },
        { mnemonic: "aload_3", op: 0x2d, len: 1, fn: (vm) => {
            let v = vm.frameStack.getLocalVar(3);
            vm.frameStack.stackPush(v);
        } },
        { mnemonic: "iaload", op: 0x2e, len: 1, fn: null },
        { mnemonic: "laload", op: 0x2f, len: 1, fn: null },
        { mnemonic: "faload", op: 0x30, len: 1, fn: null },
        { mnemonic: "daload", op: 0x31, len: 1, fn: null },
        { mnemonic: "aaload", op: 0x32, len: 1, fn: null },
        { mnemonic: "baload", op: 0x33, len: 1, fn: null },
        { mnemonic: "caload", op: 0x34, len: 1, fn: null },
        { mnemonic: "saload", op: 0x35, len: 1, fn: null },
        { mnemonic: "istore", op: 0x36, len: 2, fn: (vm, a) => {
            let v = vm.frameStack.stackPop();
            vm.frameStack.setLocalVar(a, v);
        } },
        { mnemonic: "lstore", op: 0x37, len: 2, fn: null },
        { mnemonic: "fstore", op: 0x38, len: 2, fn: null },
        { mnemonic: "dstore", op: 0x39, len: 2, fn: null },
        { mnemonic: "astore", op: 0x3a, len: 2, fn: null },
        
        { mnemonic: "istore_0", op: 0x3b, len: 1, fn: (vm) => {
            let v = vm.frameStack.stackPop();
            vm.frameStack.setLocalVar(0, v);
        } },
        { mnemonic: "istore_1", op: 0x3c, len: 1, fn: (vm) => {
            let v = vm.frameStack.stackPop();
            vm.frameStack.setLocalVar(1, v);
        } },
        { mnemonic: "istore_2", op: 0x3d, len: 1, fn: (vm) => {
            let v = vm.frameStack.stackPop();
            vm.frameStack.setLocalVar(2, v);
        } },
        { mnemonic: "istore_3", op: 0x3e, len: 1, fn: (vm) => {
            let v = vm.frameStack.stackPop();
            vm.frameStack.setLocalVar(3, v);
        } },
    
        { mnemonic: "lstore_0", op: 0x3f, len: 1, fn: null },
        { mnemonic: "lstore_1", op: 0x40, len: 1, fn: null },
        { mnemonic: "lstore_2", op: 0x41, len: 1, fn: null },
        { mnemonic: "lstore_3", op: 0x42, len: 1, fn: null },
        { mnemonic: "fstore_0", op: 0x43, len: 1, fn: null },
        { mnemonic: "fstore_1", op: 0x44, len: 1, fn: null },
        { mnemonic: "fstore_2", op: 0x45, len: 1, fn: null },
        { mnemonic: "fstore_3", op: 0x46, len: 1, fn: null },
        { mnemonic: "dstore_0", op: 0x47, len: 1, fn: null },
        { mnemonic: "dstore_1", op: 0x48, len: 1, fn: null },
        { mnemonic: "dstore_2", op: 0x49, len: 1, fn: null },
        { mnemonic: "dstore_3", op: 0x4a, len: 1, fn: null },
        { mnemonic: "astore_0", op: 0x4b, len: 1, fn: null },
        { mnemonic: "astore_1", op: 0x4c, len: 1, fn: null },
        { mnemonic: "astore_2", op: 0x4d, len: 1, fn: null },
        { mnemonic: "astore_3", op: 0x4e, len: 1, fn: null },
        { mnemonic: "iastore", op: 0x4f, len: 1, fn: null },
        { mnemonic: "lastore", op: 0x50, len: 1, fn: null },
        { mnemonic: "fastore", op: 0x51, len: 1, fn: null },
        { mnemonic: "dastore", op: 0x52, len: 1, fn: null },
        { mnemonic: "aastore", op: 0x53, len: 1, fn: null },
        { mnemonic: "bastore", op: 0x54, len: 1, fn: null },
        { mnemonic: "castore", op: 0x55, len: 1, fn: null },
        { mnemonic: "sastore", op: 0x56, len: 1, fn: null },
        { mnemonic: "pop", op: 0x57, len: 1, fn: (vm) => {
            vm.frameStack.stackPop();
        } },
        { mnemonic: "pop2", op: 0x58, len: 1, fn: null },
        { mnemonic: "dup", op: 0x59, len: 1, fn: (vm) => {
            let dup = vm.frameStack.stackPop();
            vm.frameStack.push(dup);
            vm.frameStack.push(dup);
        } },
        { mnemonic: "dup_x1", op: 0x5a, len: 1, fn: (vm) => {
            let top = vm.frameStack.stackPop();
            let top_1 = vm.frameStack.stackPop();
            vm.frameStack.push(top);
            vm.frameStack.push(top_1);
            vm.frameStack.push(top);
        } },
        { mnemonic: "dup_x2", op: 0x5b, len: 1, fn: (vm) => {
            let top = vm.frameStack.stackPop();
            let top_1 = vm.frameStack.stackPop();
            let top_2 = vm.frameStack.stackPop();
            vm.frameStack.push(top);
            vm.frameStack.push(top_2);
            vm.frameStack.push(top_1);
            vm.frameStack.push(top);
        } },
        { mnemonic: "dup2", op: 0x5c, len: 1, fn: null },
        { mnemonic: "dup2_x1", op: 0x5d, len: 1, fn: null },
        { mnemonic: "dup2_x2", op: 0x5e, len: 1, fn: null },
        { mnemonic: "swap", op: 0x5f, len: 1, fn: null },
        { mnemonic: "iadd", op: 0x60, len: 1, fn: (vm) => {
            let a = vm.frameStack.stackPop();
            let b = vm.frameStack.stackPop();
            vm.frameStack.stackPush(~~(b + a)); // no overflow check
        } },
        { mnemonic: "ladd", op: 0x61, len: 1, fn: null },
        { mnemonic: "fadd", op: 0x62, len: 1, fn: null },
        { mnemonic: "dadd", op: 0x63, len: 1, fn: null },
        { mnemonic: "isub", op: 0x64, len: 1, fn: (vm) => {
            let a = vm.frameStack.stackPop();
            let b = vm.frameStack.stackPop();
            vm.frameStack.stackPush(~~(b - a));
        } },
        { mnemonic: "lsub", op: 0x65, len: 1, fn: null },
        { mnemonic: "fsub", op: 0x66, len: 1, fn: null },
        { mnemonic: "dsub", op: 0x67, len: 1, fn: null },
        { mnemonic: "imul", op: 0x68, len: 1, fn: (vm) => {
            let a = vm.frameStack.stackPop();
            let b = vm.frameStack.stackPop();
            vm.frameStack.stackPush(~~(b * a)); // no overflow check
        } },
        { mnemonic: "lmul", op: 0x69, len: 1, fn: null },
        { mnemonic: "fmul", op: 0x6a, len: 1, fn: null },
        { mnemonic: "dmul", op: 0x6b, len: 1, fn: null },
        { mnemonic: "idiv", op: 0x6c, len: 1, fn: (vm) => {
            let a = vm.frameStack.stackPop();
            let b = vm.frameStack.stackPop();
            vm.frameStack.stackPush(~~(b / a));
        } },
        { mnemonic: "ldiv", op: 0x6d, len: 1, fn: null },
        { mnemonic: "fdiv", op: 0x6e, len: 1, fn: null },
        { mnemonic: "ddiv", op: 0x6f, len: 1, fn: null },
        { mnemonic: "irem", op: 0x70, len: 1, fn: (vm) => {
            let a = vm.frameStack.stackPop();
            let b = vm.frameStack.stackPop();
            vm.frameStack.stackPush(~~(b % a));
        } },
        { mnemonic: "lrem", op: 0x71, len: 1, fn: null },
        { mnemonic: "frem", op: 0x72, len: 1, fn: null },
        { mnemonic: "drem", op: 0x73, len: 1, fn: null },
        { mnemonic: "ineg", op: 0x74, len: 1, fn: null },
        { mnemonic: "lneg", op: 0x75, len: 1, fn: null },
        { mnemonic: "fneg", op: 0x76, len: 1, fn: null },
        { mnemonic: "dneg", op: 0x77, len: 1, fn: null },
        { mnemonic: "ishl", op: 0x78, len: 1, fn: null },
        { mnemonic: "lshl", op: 0x79, len: 1, fn: null },
        { mnemonic: "ishr", op: 0x7a, len: 1, fn: null },
        { mnemonic: "lshr", op: 0x7b, len: 1, fn: null },
        { mnemonic: "iushr", op: 0x7c, len: 1, fn: null },
        { mnemonic: "lushr", op: 0x7d, len: 1, fn: null },
        { mnemonic: "iand", op: 0x7e, len: 1, fn: null },
        { mnemonic: "land", op: 0x7f, len: 1, fn: null },
        { mnemonic: "ior", op: 0x80, len: 1, fn: null },
        { mnemonic: "lor", op: 0x81, len: 1, fn: null },
        { mnemonic: "ixor", op: 0x82, len: 1, fn: null },
        { mnemonic: "lxor", op: 0x83, len: 1, fn: null },
        { mnemonic: "iinc", op: 0x84, len: 3, fn: (vm, idx, agg) => {
            let a = vm.frameStack.getLocalVar(idx);
            vm.frameStack.setLocalVar(idx, a + agg);
        } },
        { mnemonic: "i2l", op: 0x85, len: 1, fn: null },
        { mnemonic: "i2f", op: 0x86, len: 1, fn: null },
        { mnemonic: "i2d", op: 0x87, len: 1, fn: null },
        { mnemonic: "l2i", op: 0x88, len: 1, fn: null },
        { mnemonic: "l2f", op: 0x89, len: 1, fn: null },
        { mnemonic: "l2d", op: 0x8a, len: 1, fn: null },
        { mnemonic: "f2i", op: 0x8b, len: 1, fn: null },
        { mnemonic: "f2l", op: 0x8c, len: 1, fn: null },
        { mnemonic: "f2d", op: 0x8d, len: 1, fn: null },
        { mnemonic: "d2i", op: 0x8e, len: 1, fn: null },
        { mnemonic: "d2l", op: 0x8f, len: 1, fn: null },
        { mnemonic: "d2f", op: 0x90, len: 1, fn: null },
        { mnemonic: "i2b", op: 0x91, len: 1, fn: null },
        { mnemonic: "i2c", op: 0x92, len: 1, fn: null },
        { mnemonic: "i2s", op: 0x93, len: 1, fn: null },
        { mnemonic: "lcmp", op: 0x94, len: 1, fn: null },
        { mnemonic: "fcmpl", op: 0x95, len: 1, fn: null },
        { mnemonic: "fcmpg", op: 0x96, len: 1, fn: null },
        { mnemonic: "dcmpl", op: 0x97, len: 1, fn: null },
        { mnemonic: "dcmpg", op: 0x98, len: 1, fn: null },
        { mnemonic: "ifeq", op: 0x99, len: 3, fn: (vm, offsetH, offsetL) => {
            let v = vm.frameStack.stackPop();
            if(v === 0)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        } },
        { mnemonic: "ifne", op: 0x9a, len: 3, fn: (vm, offsetH, offsetL) => {
            let v = vm.frameStack.stackPop();
            if(v !== 0)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        }  },
        { mnemonic: "iflt", op: 0x9b, len: 3, fn: (vm, offsetH, offsetL) => {
            let v = vm.frameStack.stackPop();
            if(v < 0)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        }  },
        { mnemonic: "ifge", op: 0x9c, len: 3, fn: (vm, offsetH, offsetL) => {
            let v = vm.frameStack.stackPop();
            if(v >= 0)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        }  },
        { mnemonic: "ifgt", op: 0x9d, len: 3, fn: (vm, offsetH, offsetL) => {
            let v = vm.frameStack.stackPop();
            if(v > 0)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        }  },
        { mnemonic: "ifle", op: 0x9e, len: 3, fn: (vm, offsetH, offsetL) => {
            let v = vm.frameStack.stackPop();
            if(v < 0)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        }  },
        { mnemonic: "if_icmpeq", op: 0x9f, len: 3, fn: (vm, offsetH, offsetL) => {
            let b = vm.frameStack.stackPop();
            let v = vm.frameStack.stackPop();
            if(v === b)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        } },
        { mnemonic: "if_icmpne", op: 0xa0, len: 3, fn: (vm, offsetH, offsetL) => {
            let b = vm.frameStack.stackPop();
            let v = vm.frameStack.stackPop();
            if(v !== b)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        } },
        { mnemonic: "if_icmplt", op: 0xa1, len: 3, fn: (vm, offsetH, offsetL) => {
            let b = vm.frameStack.stackPop();
            let v = vm.frameStack.stackPop();
            if(v < b)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        } },
        { mnemonic: "if_icmpge", op: 0xa2, len: 3, fn: (vm, offsetH, offsetL) => {
            let b = vm.frameStack.stackPop();
            let v = vm.frameStack.stackPop();
            if(v >= b)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        } },
        { mnemonic: "if_icmpgt", op: 0xa3, len: 3, fn: (vm, offsetH, offsetL) => {
            let b = vm.frameStack.stackPop();
            let v = vm.frameStack.stackPop();
            if(v > b)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        } },
        { mnemonic: "if_icmple", op: 0xa4, len: 3, fn: (vm, offsetH, offsetL) => {
            let b = vm.frameStack.stackPop();
            let v = vm.frameStack.stackPop();
            if(v <= b)
                vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        } },
        { mnemonic: "if_acmpeq", op: 0xa5, len: 3, fn: null },
        { mnemonic: "if_acmpne", op: 0xa6, len: 3, fn: null },
        { mnemonic: "goto", op: 0xa7, len: 3, fn: (vm, offsetH, offsetL) => {
            vm.pc += Exec.signed16(offsetH, offsetL) - 3;
        } },
        { mnemonic: "jsr", op: 0xa8, len: 3, fn: null },
        { mnemonic: "ret", op: 0xa9, len: 2, fn: null },
        { mnemonic: "tableswitch", op: 0xaa, len: 1, fn: null },
        { mnemonic: "lookupswitch", op: 0xab, len: 1, fn: null },
        { mnemonic: "ireturn", op: 0xac, len: 1, fn: null },
        { mnemonic: "lreturn", op: 0xad, len: 1, fn: null },
        { mnemonic: "freturn", op: 0xae, len: 1, fn: null },
        { mnemonic: "dreturn", op: 0xaf, len: 1, fn: null },
        { mnemonic: "areturn", op: 0xb0, len: 1, fn: null },
        { mnemonic: "return", op: 0xb1, len: 1, fn: (vm) => {
            vm.status = false; // TODO: support popping the stack
        } },
        { mnemonic: "getstatic", op: 0xb2, len: 3, fn: (vm, high, low) => {
            let index = (((high << 8) | low) >>> 0);
            vm.frameStack.stackPush(index);
        } },
        { mnemonic: "putstatic", op: 0xb3, len: 3, fn: null },
        { mnemonic: "getfield", op: 0xb4, len: 3, fn: null },
        { mnemonic: "putfield", op: 0xb5, len: 3, fn: null },
        { mnemonic: "invokevirtual", op: 0xb6, len: 3, fn: (vm, high, low) => {
            let index = (((high << 8) | low) >>> 0);
            let grab = (a) => {
                let idx1 = vm.frameStack.getConst(index).value.ref[a[0]];
                let idx2 = vm.frameStack.getConst(idx1).value.ref[a[1]];
                return vm.frameStack.getConst(idx2).value.string;
            };
            let classString = grab(["class_idx", "class_idx"]);
            let methodString = grab(["name_idx", "class_idx"]);
            let signatureString = grab(["name_idx", "name_idx"]);        
            term.red.bold(`\tClass: ${classString}; Method: ${methodString}; Signature: ${signatureString}\n`);
            vm.builtIn.invoke(vm, classString, methodString, signatureString);
        } },
        { mnemonic: "invokespecial", op: 0xb7, len: 3, fn: (vm, high, low) => {
            let index = (((high << 8) | low) >>> 0);
    
            let grab = (a) => {
                let idx1 = vm.frameStack.getConst(index).value.ref[a[0]];
                let idx2 = vm.frameStack.getConst(idx1).value.ref[a[1]];
                return vm.frameStack.getConst(idx2).value.string;    
            };
            let classString = grab(["class_idx", "class_idx"]);
            let methodString = grab(["name_idx", "class_idx"]);
            let signatureString = grab(["name_idx", "name_idx"]);        
            term.red.bold(`\tClass: ${classString}; Method: ${methodString}; Signature: ${signatureString}\n`);
            vm.builtIn.invoke(vm, classString, methodString, signatureString);
        } },
        { mnemonic: "invokestatic", op: 0xb8, len: 3, fn: null },
        { mnemonic: "invokeinterface", op: 0xb9, len: 5, fn: null },
        { mnemonic: "invokedynamic", op: 0xba, len: 5, fn: null },
        { mnemonic: "new", op: 0xbb, len: 3, fn: null },
        { mnemonic: "newarray", op: 0xbc, len: 2, fn: null },
        { mnemonic: "anewarray", op: 0xbd, len: 3, fn: null },
        { mnemonic: "arraylength", op: 0xbe, len: 1, fn: null },
        { mnemonic: "athrow", op: 0xbf, len: 1, fn: null },
        { mnemonic: "checkcast", op: 0xc0, len: 3, fn: null },
        { mnemonic: "instanceof", op: 0xc1, len: 3, fn: null },
        { mnemonic: "monitorenter", op: 0xc2, len: 1, fn: null },
        { mnemonic: "monitorexit", op: 0xc3, len: 1, fn: null },
        { mnemonic: "wide", op: 0xc4, len: 1, fn: null },
        { mnemonic: "multianewarray", op: 0xc5, len: 4, fn: null },
        { mnemonic: "ifnull", op: 0xc6, len: 3, fn: null },
        { mnemonic: "ifnonnull", op: 0xc7, len: 3, fn: null },
        { mnemonic: "goto_w", op: 0xc8, len: 5, fn: null },
        { mnemonic: "jsr_w", op: 0xc9, len: 5, fn: null },
        { mnemonic: "breakpoint", op: 0xca, len: 1, fn: null },
    ]
};

// JS conversion of https://github.com/atcol/cfr
// Needs to be replaced, since it's GPL3 and I plan on using the MIT License
class ClassLoader {
    constructor(fileContents) {
        this.classContents = fileContents;
        this.ptr = 0;
        this.minorVersion = 0;
        this.majorVersion = 0;
        this.constPoolCount = 0;
        this.constPool = [];
        this.poolSizeBytes = 0;
        this.load();
    }
    load() {
        // This is in a specific order. Don't modify
        if(!this.getCafeBabe())
            throw "Not a parsable Java Class file.";
        this.parseHeader();        
        if(this.parseConstPool() === 0)
            throw "Invalid constants pool size";
        this.parseClassProperties();
        this.parseInterfaces();
        this.parseFields();
        this.parseMethods();
        this.parseAttributes();
        return this;
    }
    getCafeBabe() {
        let [a, b, c, d] = [
            this.classContents[0],
            this.classContents[1],
            this.classContents[2],
            this.classContents[3],
        ];
        this.ptr += dword;
        return (((a << 24 | b << 16 | c << 8 | d) >>> 0) == 0xCAFEBABE);
    }
    parseHeader() {
        this.minorVersion = this.getValue(word);
        this.majorVersion = this.getValue(word);
        this.constPoolCount = this.getValue(word);
    }
    getValue(size) {
        // stored in big endian, so we can just use 8bits at a time.
        // downside: very slow
        let value = 0;
        for(let x = 0; x < size; x++)
            value = (value << (x * 8)) | this.classContents[this.ptr + x];
        this.ptr += size;
        return value >>> 0;
    }
    parseClassProperties() {
        this.flags = this.getValue(word);
        this.this_class = this.getValue(word);
        this.super_class = this.getValue(word);
    }
    parseConstPool() {
        const MaxItems = this.constPoolCount - 1;
        let tableSize = 0;
        for(let x = 1; x <= MaxItems; x++) {
            let item = { valid: true, value: {
                string: null,
                integer: null,
                float: null,
                long: { high: null, low: null },
                double: { high: null, low: null },
                ref: { class_idx: null, name_idx: null },
            } };
            item.tagByte = this.getValue(byte);
            switch(item.tagByte) {
            case STRING_UTF8: {
                let length = this.getValue(word);
                item.value.string = "";
                for(let y = 0; y < length; y++)
                    item.value.string += String.fromCharCode(this.getValue(byte));
                tableSize += word + length;
                break;
            }
            case INTEGER:
                item.value.integer = this.getValue(dword);
                tableSize += dword;
                break;
            case FLOAT:
                item.value.float = this.getValue(dword);
                tableSize += dword;
                break;
            case LONG:
                item.value.long.high = this.getValue(dword);
                item.value.long.low = this.getValue(dword);
                ++x; // consumes two items
                tableSize += dword * 2;
                break;
            case DOUBLE:
                item.value.double.high = this.getValue(dword);
                item.value.double.low = this.getValue(dword);
                ++x; // consumes two items
                tableSize += dword * 2;
                break;
            case CLASS:
            case STRING:
                item.value.ref.class_idx = this.getValue(word);
                tableSize += word;
                break;
            case FIELD:
            case METHOD:
            case INTERFACE_METHOD:
            case NAME:
                item.value.ref.class_idx = this.getValue(word);
                item.value.ref.name_idx = this.getValue(word);
                tableSize += word * 2;
                break;
            default:
                term.red.color(`Unsupported tag byte ${item.tagByte}\n`);
                item.valid = false;
                break;
            }
            if(item.valid) this.constPool.push(item);
        }
        this.poolSizeBytes = tableSize;
        return tableSize;
    }
    parseInterfaces() {
        this.interfaces_count = this.getValue(word);
        this.interfaces = [...Array(this.interfaces_count)];
        for(let x = 0; x < this.interfaces_count; this.interfaces[x++] = this.getValue(word));
    }
    parseFields() {
        this.fieldsCount = this.getValue(word);
        this.fields = [...Array(this.fieldsCount)];
        for(let x = 0; x < this.fieldsCount; x++) {
            this.fields[x] = {
                flags: this.getValue(word),
                name_idx: this.getValue(word),
                desc_idx: this.getValue(word),
                attrs_count: this.getValue(word),
                attrs: undefined,
            };
            this.fields[x].attrs = [...Array(this.fields[x].attrs_count)];
            let len = this.fields[x].attrs_count;
            for(let n = 0; n < len; n++) {
                this.fields[x].attrs[n] = this.parseAttribute();
            }
        }
    }
    parseMethods() {
        this.methodsCount = this.getValue(word);
        this.methods = [...Array(this.methodsCount)];
        for(let x = 0; x < this.methodsCount; x++) {
            this.methods[x] = {
                flags: this.getValue(word),
                name_idx: this.getValue(word),
                desc_idx: this.getValue(word),
                attrs_count: this.getValue(word),
                attrs: undefined,
            };
            this.methods[x].attrs = [...Array(this.methods[x].attrs_count)];
            let len = this.methods[x].attrs_count;
            for(let n = 0; n < len; n++) {
                this.methods[x].attrs[n] = this.parseAttribute();
            }
        }
    }
    parseAttributes() {
        this.attributesCount = this.getValue(word);
        this.attributes = [...Array(this.attributesCount)];
        let len = this.attributesCount;
        for(let n = 0; n < len; n++)
            this.attributes[n] = this.parseAttribute();
    }
    parseAttribute() {
        let idx = this.getValue(word);
        let len = this.getValue(dword);
        let that = this;
        return {
            name_idx: idx,
            length: len,
            info: [...Array(len)].map(() => that.classContents[that.ptr++]),
        };
    }
    getConstByIndex(idx) {
        return this.constPool[idx - 1];
    }
    findConstMethodByString(strValue) {
        return this.methods.filter(x => {
            // const pool indexes are one based, but loaded zero based.
            return this.constPool[x.name_idx - 1].value.string === strValue; //"main" && x.flags === 9;
        });
    }
    findConstByFlag(flagValue) {
        return this.methods.filter(x => {
            return x.flags === flagValue;
        });
    }
    findStaticMain() {
        return this.findConstMethodByString("main").find(x => x.flags === (ACC_PUBLIC | ACC_STATIC));
    }
    getStringReferenceValue(idx) {
        let referenceIndex = this.getConstByIndex(idx).value.ref.class_idx;
        return this.getConstByIndex(referenceIndex).value.string;
    }
    getClassName() {
        return this.getStringReferenceValue(this.this_class);
    }
    getSuperName() {
        return this.getStringReferenceValue(this.super_class);
    }
}

class RuntimeConstantPool {
    constructor(constPool) { this.constPool = constPool; }
    getInternedString(idx) { return this.constPool[idx].value.string; }
    getInternedInteger(idx) { return this.constPool[idx].value.integer; }
    getConst(idx) { return this.constPool[idx - 1]; /* 1s based in bytecode */ }
}

class Frame {
    constructor(scope) {
        this.localVars = [];
        this.operands = [];
        this.scope = scope || -1;
    }
    push(value) { this.operands.push(value); }
    pop() { return this.operands.pop(); }
    getLocalVar(idx) { return this.localVars[idx]; }
    setLocalVar(idx, value) { this.localVars[idx] = value; }
    shrink(len) {
        for(let x = 0; x < len; x++)
            this.operands.pop();
    }
    isEmpty() { return this.operands.length === 0; }
}

class Stack {
    constructor() {
        this._stack = [];
        this._frame = null;
    }
    add() {
        this._frame = new Frame(this._stack.length);
        return this._stack.push(this._frame) - 1;
    }
    remove() {
        this._stack.pop();
        let idx = this._stack.length - 1;
        this._frame = this._stack[idx];
        return idx;
    }
    get top() { return this._frame; }
}

// Handles the current scope
class Scope {
    constructor(constPool) {
        this.stack = new Stack();
        this.constPool = new RuntimeConstantPool(constPool);
    }
    push() { this.stack.add(); }
    pop() { return this.stack.remove(); }
    getLocalVar(idx) { return this.stack.top.getLocalVar(idx); }
    setLocalVar(idx, value) { this.stack.top.setLocalVar(idx, value); }
    stackPop() { return this.stack.top.pop(); }
    stackPush(value) { this.stack.top.push(value); }
    stackShrink(len) { this.stack.top.shrink(len); }
    stackIsEmpty() { return this.stack.top.isEmpty(); }
    getInternedString(idx) { return this.constPool.getInternedString(idx); }
    getInternedInteger(idx) { return this.constPool.getInternedInteger(idx); }
    getConst(idx) { return this.constPool.getConst(idx); }
}

// Emit code from a loaded class
class ClassCodeEmitter {
    static emit(classLoader) {
        let getValue = (size, src, locAgg) => {
            let value = 0;
            for(let x = 0; x < size; x++)
                value = (value << (x * 8)) | src[locAgg + x];
            locAgg += size;
            return [value >>> 0, locAgg];
        };
        let ops = classLoader.attrs.map(x => {
            let loc = 0, maxStack = 0, maxLocals = 0, codeLength = 0;
            let attributeNameIndex = x.name_idx;
            let attributeLength = x.length;
            [maxStack, loc] = getValue(word, x.info, loc);
            [maxLocals, loc] = getValue(word, x.info, loc);
            [codeLength, loc] = getValue(dword, x.info, loc);
            let code = x.info.slice(loc, loc + codeLength);
            return {
                attributeNameIndex: attributeNameIndex,
                attributeLength: attributeLength,
                maxStack: maxStack,
                maxLocals: maxLocals,
                codeLength: codeLength,
                code: code,
            };
        });
        return ops;
    }
}

class JavaEngine {
    constructor(bootstrap, classes) {
        this.classes = classes;
        this.bootstrap = bootstrap;
        this.codeArray = [];
        let mainClass = null; // this is a reference to the entry point of the application.
        this.vm = { // one of these per thread
            attributes: [],
            opcodes: [],
            pc: 0,
            status: true,
            frameStack: null,
            builtIn: new BuiltIn(),
        };
        
        // Load all classes
        this.loadedClasses = this.classes.map(x => {
            let c = new ClassLoader(x);
            if(c.getClassName().toLowerCase() === bootstrap.toLowerCase())
                mainClass = c;
            return c;
        });

        // TODO: check if mainClass is null before trying to access it.
        let staticMainMethod = mainClass.findStaticMain();
        if(staticMainMethod != null) {
            this.initEnvironment(mainClass);
            this.loadByteCodeForMethod(staticMainMethod);
            //this.run(this.codeArray[0]); // need to find out when there is more than one attribute count
        } else {
            term.blue.bold("Cannot find public static main.\n");
            this.vm.status = false;
        }
        //this.attributes = attributes;
        //this.ops = [];
        //this.counter = 0;
    }
    execute() {
        this.run(this.codeArray[0]);
    }
    initEnvironment(c) {
        this.vm.frameStack = new Scope(c.constPool);
        this.vm.frameStack.push();
    }
    loadByteCodeForMethod(c) {
        this.codeArray = ClassCodeEmitter.emit(c);
    }
    run(code) {
        let scope = code;
        while(this.vm.status) {
            if(this.vm.pc >= scope.code.length) {
                this.vm.status = false;
                break;
            }            
            this.step(scope);
        }
        term.blue.bold("Complete.\n");
    }
    step(scope) {
        // rewrite this.
        let opCode = scope.code[this.vm.pc];
        let operation = Exec.xref(opCode);
        if(operation != null) {
            let str = `${this.vm.pc} : ${operation.mnemonic} `;
            let params = [];
            for(let x = 0; x < operation.len; x++) {
                params.push(scope.code[this.vm.pc + x]);
                str += scope.code[this.vm.pc + x] + " ";
            }
            term.red.bold(str + "\n");
            params.shift(); params.unshift(this.vm);
            operation.fn.apply(this, params);
            this.vm.pc += operation.len;
        } else {
            this.vm.status = false;
        }
    }
}

if(process.argv.length <= 3){
    term.blue.bold("Usage: toy-jvm [...classlist] [public static main() class name]\n");
    term.blue.bold(`Opcodes Implemented: ${Exec.implCount()} out of ${Exec.ops.length}`);
    process.exit();
} else {
    //try {
    const files = [];
    for(let i = 2; i < process.argv.length - 1; i++) {
        files.push(fs.readFileSync(process.argv[i]));
    }
    const bootstrapClassName = process.argv[process.argv.length - 1];
    const JVM = new JavaEngine(bootstrapClassName, files);
    JVM.execute();
    //} catch (exception) {
    //    term.red(exception);
    //    term("\n");
    //}
}

