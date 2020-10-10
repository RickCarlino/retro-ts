/* Nga ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Copyright (c) 2008 - 2019, Charles Childers
   Copyright (c) 2009 - 2010, Luke Parrish
   Copyright (c) 2010,        Marc Simpson
   Copyright (c) 2010,        Jay Skeer
   Copyright (c) 2011,        Kenneth Keating
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
import { ngaImage } from "./image";

var IMAGE_SIZE = 524288;    /* Amount of simulated RAM    */
var DATA_DEPTH = 8192;      /* Depth of data stack        */
var ADDRESS_DEPTH = 32768;  /* Depth of the stacks        */
var framebuffer = 0;


const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const consoleEl = document.getElementById("console") as HTMLTextAreaElement;
const inputEl = document.getElementById("input") as HTMLTextAreaElement;

function getInputBuffer(): string { return inputEl.value; }
function replaceInputBuffer(s: string) {
  inputEl.value = s;
}

function writeConsole(s: string) {
  consoleEl.value += s;
}

function clearConsole() {
  consoleEl.value = "";
}
class Stack {
  sp: number = 0;
  data: number[];

  constructor(size: number) {
    this.data = new Array(size);
  }

  push = (n: number) => {
    this.sp++;
    this.data[this.sp] = n;
  }

  pop = () => {
    return this.data[this.sp--];
  }

  depth = () => {
    return this.sp;
  }

  tos = () => {
    return this.data[this.sp];
  }

  nos = () => {
    return this.data[this.sp - 1];
  }

  dup = () => {
    this.push(this.tos());
  }

  drop = () => {
    this.sp--;
  }

  swap = () => {
    var a = this.nos();
    this.data[this.sp - 1] = this.tos();
    this.data[this.sp] = a;
  }

  inc = () => {
    this.data[this.sp]++;
  }

  dec = () => {
    this.data[this.sp]--;
  }

  reset = () => {
    this.sp = 0;
  }
}

enum Opcodes {
  NOP = 0,
  LIT = 1,
  DUP = 2,
  DROP = 3,
  SWAP = 4,
  PUSH = 5,
  POP = 6,
  JUMP = 7,
  CALL = 8,
  CCALL = 9,
  RETURN = 10,
  EQ = 11,
  NEQ = 12,
  LT = 13,
  GT = 14,
  FETCH = 15,
  STORE = 16,
  ADD = 17,
  SUB = 18,
  MUL = 19,
  DIVMOD = 20,
  AND = 21,
  OR = 22,
  XOR = 23,
  SHIFT = 24,
  ZERO_EXIT = 25,
  HALT = 26,
  IE = 27,
  IQ = 28,
  II = 29,
}

var ip = 0;
var data = new Stack(DATA_DEPTH);
var address = new Stack(ADDRESS_DEPTH);
var image = new Array(IMAGE_SIZE);
var vm = Opcodes;
var instructions: (() => void)[] = new Array(vm.II + 1);
var notfound = 0;
var interpret = 0;

function rxPrepareVM() {
  ip = 0;
  data.reset();
  address.reset();
  framebuffer = 0;
}

instructions[vm.NOP] = () => { }
instructions[vm.LIT] = () => {
  ip++;
  data.push(image[ip]);
}
instructions[vm.DUP] = () => {
  data.dup();
}
instructions[vm.DROP] = () => {
  data.drop();
}
instructions[vm.SWAP] = () => {
  data.swap();
}
instructions[vm.PUSH] = () => {
  address.push(data.pop());
}
instructions[vm.POP] = () => {
  data.push(address.pop())
}
instructions[vm.JUMP] = () => {
  ip = data.pop() - 1;
}
instructions[vm.CALL] = () => {
  address.push(ip);
  ip = data.pop() - 1;
}
instructions[vm.CCALL] = () => {
  var a, b;
  a = data.pop();
  b = data.pop();
  if (b != 0) {
    address.push(ip);
    ip = a - 1;
  }
}
instructions[vm.RETURN] = () => {
  ip = address.pop();
}
instructions[vm.EQ] = () => {
  var a, b;
  a = data.pop();
  b = data.pop();
  if (b == a)
    data.push(-1);
  else
    data.push(0);
}
instructions[vm.NEQ] = () => {
  var a, b;
  a = data.pop();
  b = data.pop();
  if (b != a)
    data.push(-1);
  else
    data.push(0);
}
instructions[vm.LT] = () => {
  var a, b;
  a = data.pop();
  b = data.pop();
  if (b < a)
    data.push(-1);
  else
    data.push(0);
}

instructions[vm.GT] = () => {
  var a, b;
  a = data.pop();
  b = data.pop();
  if (b > a)
    data.push(-1);
  else
    data.push(0);
}

instructions[vm.FETCH] = () => {
  const x = data.pop();
  if (x == -1)
    data.push(data.sp);
  else if (x == -2)
    data.push(address.sp);
  else if (x == -3)
    data.push(IMAGE_SIZE);
  else if (x == -4)
    data.push(-2147483648);
  else if (x == -5)
    data.push(2147483647);
  else
    data.push(image[x]);
}

instructions[vm.STORE] = () => {
  image[data.tos()] = data.nos();
  data.drop();
  data.drop();
}

instructions[vm.ADD] = () => {
  var x = data.pop();
  var y = data.pop();
  data.push(x + y);
}
instructions[vm.SUB] = () => {
  var x = data.pop();
  var y = data.pop();
  data.push(y - x);
}
instructions[vm.MUL] = () => {
  var x = data.pop();
  var y = data.pop();
  data.push(y * x);
}
instructions[vm.DIVMOD] = () => {
  var b = data.pop();
  var a = data.pop();
  if (b == 0) {
    ip = 0;
    data.sp = 0;
    address.sp = 0;
  } else {
    var x = Math.abs(b);
    var y = Math.abs(a);
    var q = Math.floor(y / x);
    var r = y % x;
    if (a < 0 && b < 0)
      r = r * -1;
    if (a > 0 && b < 0)
      q = q * -1;
    if (a < 0 && b > 0) {
      r = r * -1;
      q = q * -1;
    }
    data.push(r);
    data.push(q);
  }
}
instructions[vm.AND] = () => {
  var x = data.pop();
  var y = data.pop();
  data.push(x & y);
}
instructions[vm.OR] = () => {
  var x = data.pop();
  var y = data.pop();
  data.push(x | y);
}
instructions[vm.XOR] = () => {
  var x = data.pop();
  var y = data.pop();
  data.push(x ^ y);
}
instructions[vm.SHIFT] = () => {
  var x = data.pop();
  var y = data.pop();
  if (x < 0)
    data.push(y << (x * -1));
  else
    data.push(y >>= x);
}
instructions[vm.ZERO_EXIT] = () => {
  if (data.tos() == 0) {
    data.drop();
    ip = address.pop();
  }
}
instructions[vm.HALT] = () => {
  ip = IMAGE_SIZE;
}
instructions[vm.IE] = () => {
  data.push(2);
}
instructions[vm.IQ] = () => {
  var chosen = data.pop();
  if (chosen == 0) {
    data.push(0);
    data.push(0);
  } else if (chosen == 1) {
    data.push(20);
    data.push(0);
  }
}
instructions[vm.II] = () => {
  var chosen = data.pop();
  if (chosen == 0) {
    var s = String.fromCharCode(data.pop());
    writeConsole(s);
  } else if (chosen == 1) {
    draw(data.pop())
  }
}

window.addEventListener('load', rxPrepareVM, false);

function processOpcode(opcode: number) {
  if (opcode != 0) {
    instructions[opcode]();
    checkStack();
  }
}

function validatePackedOpcodes(opcode: number) {
  var raw = opcode;
  var current;
  var valid = -1;
  var i = 0;
  while (i < 4) {
    current = raw & 0xFF;
    if (!(current >= 0 && current <= 29))
      valid = 0;
    raw = raw >> 8;
    i++;
  }
  return valid;
}

function ngaProcessPackedOpcodes(opcode: number) {
  let raw = opcode;
  const ops = new Array(3);
  ops[0] = raw & (255);
  raw = raw >> 8;
  ops[1] = raw & (255);
  raw = raw >> 8;
  ops[2] = raw & (255);
  raw = raw >> 8;
  ops[3] = raw & (255);
  processOpcode(ops[0]);
  processOpcode(ops[1]);
  processOpcode(ops[2]);
  processOpcode(ops[3]);
}


function loadInitialImage() {
  image = ngaImage.slice();
}

function execute(offset: number) {
  var opcode;
  address.sp = 1;
  ip = offset;
  while (ip < IMAGE_SIZE) {
    opcode = image[ip];
    if (ip == notfound) {
      writeConsole("err:notfound : " + string_extract(1024) + "\n");
    }
    if (validatePackedOpcodes(opcode) != 0) {
      ngaProcessPackedOpcodes(opcode);
    } else {
      alert("Invalid instruction!");
      alert("At " + ip + ", opcode " + opcode);
    }
    if (address.sp == 0)
      ip = IMAGE_SIZE;
    ip++;
  }
}

function checkStack() {
  var depth = data.depth();
  var adepth = address.depth();
  var flag = 0;
  if (depth < 0 || adepth < 0) {
    flag = -1;
  }
  if (depth > DATA_DEPTH || adepth > DATA_DEPTH) {
    flag = -1;
  }
  if (flag == -1) {
    ip = 0;
    data.sp = 0;
    address.sp = 0;
  }
}

function string_inject(str: string, buffer: number) {
  var m = str.length;
  var i = 0;
  while (m > 0) {
    image[buffer + i] = str[i].charCodeAt(0);
    image[buffer + i + 1] = 0;
    m--;
    i++;
  }
}

function string_extract(at: number) {
  let string_data = "";
  var starting = at;
  while (image[starting] != 0) {
    string_data += String.fromCharCode(image[starting++]);
  }
  return string_data;
}

function d_xt(dt: number) {
  return dt + 1;
}

function d_name(dt: number) {
  return dt + 3;
}

function d_lookup(name: string) {
  var dt = 0;
  var i = image[2];
  var dName;
  while (image[i] != 0 && i != 0) {
    dName = string_extract(d_name(i));
    if (dName == name) {
      dt = i;
      i = 0;
    } else {
      i = image[i];
    }
  }
  return dt;
}

function d_xt_for(name: string) {
  return image[d_xt(d_lookup(name))];
}

function evaluate(s: string) {
  if (s.length == 0) {
    return;
  } else {
    string_inject(s, 1024);
    data.push(1024);
    execute(interpret);
  }
}

function cls() {
  clearConsole();
  const context = canvas.getContext('2d');
  context && context.clearRect(0, 0, canvas.width, canvas.height);
}

function unu(src: string) {
  const raw = src.split("\n");
  var i = raw.length;
  var lines = new Array();
  var j = 0;
  var code = 0;
  while (j < i) {
    if (code == 1 && raw[j] == "~~~") {
      code = 0;
    } else if (code == 0 && raw[j] == "~~~") {
      code = 1;
    } else if (code == 1) {
      lines.push(raw[j]);
    }
    j++;
  }
  return lines.join(" ");
}

function go() {
  rxPrepareVM();
  loadInitialImage();
  notfound = d_xt_for("err:notfound");
  interpret = d_xt_for("interpret");
  clearConsole();
  const tokens = unu(getInputBuffer()).match(/\S+/g) || "";
  var i = tokens.length;
  var j = 0;
  while (j < i) {
    evaluate(tokens[j]);
    j++;
  }
  let s = "";
  i = data.depth();
  j = 1;
  while (j <= i) {
    s = s + data.data[j] + " ";
    j++;
  }
  // writeConsole("\n" + s);
  if (framebuffer === 0) {
    canvas.style.display = "none";
  } else {
    canvas.style.display = "block";
  }
}

function saveproject() {
  localStorage.setItem("Snapshot", getInputBuffer());
}

const DEFAULT_CODE = `
# Welcome to Retro!

Take a look at the Retro handbook at http://forth.works/book.html

~~~
'Hello_world! s:put
~~~

`;
function loadproject() {
  replaceInputBuffer(localStorage.getItem("Snapshot") || DEFAULT_CODE);
}

function draw(fb_start: number) {
  framebuffer = 1;
  var ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error("No context");
  }
  var imgData = ctx.createImageData(300, 300);
  var i;
  for (i = 0; i < imgData.data.length / 4; i += 1) {
    imgData.data[i * 4 + 0] = ((image[i + fb_start] >> 8) >> 8) & 255;
    imgData.data[i * 4 + 1] = (image[i + fb_start] >> 8) & 255;
    imgData.data[i * 4 + 2] = image[i + fb_start] & 255;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

(window as any).loadproject = loadproject;
(window as any).saveproject = saveproject;
(window as any).cls = cls;
(window as any).go = go;
