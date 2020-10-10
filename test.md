~~~
'FB d:create
  #300 #300 * allot

:draw FB #1 io:invoke ;

#300 'fb:W const
#300 'fb:H const

:fb:set-pixel (color,row,column)
  swap fb:W * + FB + store ;

:fb:hline (color,row,column,width)
  [ 'abc 'abcabc reorder fb:set-pixel n:inc ] times drop drop drop ;

:fb:vline (color,row,column,width)
  [ 'abc 'abcabc reorder fb:set-pixel &n:inc dip ] times drop drop drop ;

:s:to-number<hex> (s-n)
  dup fetch $- eq? [ n:inc #-1 ] [ #0 ] choose swap
  #0 swap [ '0123456789ABCDEF swap s:index-of + #16 * ] s:for-each
  #16 / swap 0; * ;

:fb:color ('rrggbb-n)
  s:to-number<hex> ;
~~~

~~~
'5CB3FF fb:color 'color:CrystalBlue const

color:CrystalBlue #10 #10 #100 fb:hline
draw
~~~
                 _
      __ _ _   _| |_ ___  _ __  ___ _   _
     / _` | | | | __/ _ \| '_ \/ __| | | |
    | (_| | |_| | || (_) | |_) \__ | |_| |
     \__,_|\__,_|\__\___/| .__/|___/\__, |
                         |_|        |___/
Autopsy is a set of debugging tools for RETRO.

Background
RETRO runs on a virtual machine called Nga. The instruction set is MISC inspired, consisting of just 30 instructions:

|   |    |   |    |    |    |    |    |    |    |    |    |
|---|----|---|----|----|----|----|----|----|----|----|----|
| 0 | .. | 5 | pu | 10 | re | 15 | fe | 20 | di | 25 | zr |
| 1 | li | 6 | po | 11 | eq | 16 | st | 21 | an | 26 | en |
| 2 | du | 7 | ju | 12 | ne | 17 | ad | 22 | or | 27 | ie |
| 3 | dr | 8 | ca | 13 | lt | 18 | su | 23 | xo | 28 | iq |
| 4 | sw | 9 | cc | 14 | gt | 19 | mu | 24 | sh | 29 | ii |

The first two characters of each instruction name are sufficient to identify the instruction.

Nga exposes memory as an array of 32-bit signed integers. Each memory location can store four instructions. The assembler expects the instructions to be named using their two character identifiers. E.g.,

'lica.... i
#100 d
Disassembly
I use '..' for 'no(p)' and then construct a string with all of these. This will be used to resolve names. The ?? at the end will be used for unidentified instructions.

~~~
'..lidudrswpupojucaccreeqneltgtfestadsumudianorxoshzrenieiqii??
'INST s:const
~~~
Since instructions are packed, I need to unpack them before I can run or display the individual instructions. I implement unpack for this.

~~~
{{
  :mask #255 and ;
  :next #8 shift ;
---reveal---
  :unpack (n-dcba)
    dup mask swap next
    dup mask swap next
    dup mask swap next
    'abcd 'dcba reorder ;
}}
~~~
Now it's possible to write words to display instruction bundles. The formats are kept simple. For a bundle with lit / lit / add / lit, this will display either the opcodes (1,1,17,1) or a string with the abbreviations (liliadli).

~~~
:name-for (n-cc)
  #30 n:min #2 * &INST + fetch-next swap fetch swap ;

:display:bundle<raw> (n-)
  unpack '%n,%n,%n,%n s:format s:put ;

:display:bundle<named> (n-)
  unpack #4 [ name-for c:put c:put ] times ;
~~~
So now I'm ready to write an actual disassembler. I'll provide an output formatted like this:

(address) 'instructionbundle i
(address) #value d (possibly_`reference`)
If the value corresponds to a word in the Dictionary, the disassembler will display a message indicating the possible name that corresponds to the value.

To begin, I'll add a variable to track the number of li instructions. (These require special handling as they push a value in the following cells to the stack).

~~~
'LitCount var
~~~
I then wrap name-for with a simple check that increments LitCount as needed.

~~~
:name-for<counting-li> (n-cc)
  dup #1 eq? [ &LitCount v:inc ] if name-for ;
~~~
To actually display a bundle, I need to decide on what it is. So I have a validate word to look at each instruction and make sure all are actual instructions.

~~~
:valid? (n-f)
  unpack
  [ #0 #29 n:between? ] bi@ and
  [ [ #0 #29 n:between? ] bi@ and ] dip and ;
~~~
With this and the LitCount, I can determine how to render a bundle.

I split out each type (instruction, reference/raw, and data) into a separate handler.

~~~
:render-inst (n-)
  $' c:put unpack #4 [ name-for<counting-li> c:put c:put ] times sp $i c:put ;

:render-data (n-)
  $# c:put n:to-string s:put sp $d c:put ;

:render-ref  (n-)
  dup d:lookup-xt n:-zero?
    [ dup render-data
      d:lookup-xt d:name '\t\t(possibly\_`%s`) s:format s:put ]
    [     render-data ] choose ;
~~~
Then I use these and my valid? checker to implement a single word to render the packed cell in a meaningful manner.

~~~
:render-packed (n-)
  @LitCount n:zero?
  [ dup valid?
    [ render-inst  ]
    [ render-ref ] choose ]
  [ render-ref &LitCount v:dec ] choose ;
~~~
And now to tie it all together:

~~~
'TryToIdentifyWords var

:disassemble (an-)
  #0 !LitCount
  [
    @TryToIdentifyWords
    [ dup d:lookup-xt n:-zero?
      [ dup d:lookup-xt d:name nl s:put nl ] if ] if
    fetch-next
    over $( c:put n:dec n:put $) c:put sp (address)
    render-packed nl  (inst_or_data)
  ] times drop ;
~~~
Execution Trace and Single Stepper
Ok, now on to the fun bit: execution trace and single stepping through a word.

This entails writing an implementation of Nga in RETRO. So to start, setup space for the data and address ("return") stacks, as well as variables for the stack pointers and instruction pointer.

~~~
'DataStack   d:create  #128 allot
'ReturnStack d:create  #768 allot
'SP var
'RP var
'IP var
~~~
I also set up space for the actual RAM. When single stepping or tracing, Autopsy will copy the actual RAM to this before proceeding. Note that this is limited to 128K cells.

~~~
FREE #3 / dup 'IMAGE const
FREE swap -   'IMAGE-SIZE const
~~~
Next, helpers to push values from the real stacks to the simulated ones. The stack pointer will point to the next available cell, not the actual top element.

~~~
:>s (n-) &DataStack @SP + store &SP v:inc ;
:s> (-n) &SP v:dec &DataStack @SP + fetch ;
:>r (n-) &ReturnStack @RP + store &RP v:inc ;
:r> (-n) &RP v:dec &ReturnStack @RP + fetch ;
~~~
One more helper, [IP] will return the value in memory at the location IP points to.

~~~
:[IP] @IP fetch ;
~~~
Now for the instructions. I have a separate word for each instruction and then a jump table of addresses that point to these.

~~~
:i:no                            ;
:i:li       &IP v:inc [IP] >s    ;
:i:du s>    dup            >s >s ;
:i:dr s>    drop                 ;
:i:sw s> s> swap           >s >s ;
:i:pu s>    >r                   ;
:i:po       r>             >s    ;
:i:ju s>    n:dec !IP            ;
:i:ca       @IP >r i:ju          ;
:i:cc s> s> [ >s i:ca ] [ drop ] choose ;
:i:re       r> !IP               ;
:i:eq s> s> eq?            >s    ;
:i:ne s> s> -eq?           >s    ;
:i:lt s> s> swap lt?       >s    ;
:i:gt s> s> swap gt?       >s    ;
:i:fe s>    #-1 [ @SP     >s ] case
            #-2 [ @RP     >s ] case
            #-3 [ IMAGE-SIZE >s ] case
            IMAGE + fetch  >s    ;
:i:st s> s> swap IMAGE + store   ;
:i:ad s> s> +              >s    ;
:i:su s> s> swap -         >s    ;
:i:mu s> s> *              >s    ;
:i:di s> s> swap /mod swap >s >s ;
:i:an s> s> and            >s    ;
:i:or s> s> or             >s    ;
:i:xo s> s> xor            >s    ;
:i:sh s> s> swap shift     >s    ;
:i:zr s>    dup n:zero? [ drop i:re ] [ >s ] choose ;
:i:en       #0 !RP               ;
:i:ie       #1             >s    ;
:i:iq       #0 dup         >s >s ;
:i:ii s> s> nip c:put            ;
~~~
With the instructions defined, populate the jump table. The order is crucial as the opcode number will be the index into this table.

~~~
'Instructions d:create
  &i:no ,  &i:li ,  &i:du ,  &i:dr ,  &i:sw ,  &i:pu ,
  &i:po ,  &i:ju ,  &i:ca ,  &i:cc ,  &i:re ,  &i:eq ,
  &i:ne ,  &i:lt ,  &i:gt ,  &i:fe ,  &i:st ,  &i:ad ,
  &i:su ,  &i:mu ,  &i:di ,  &i:an ,  &i:or ,  &i:xo ,
  &i:sh ,  &i:zr ,  &i:en ,  &i:ie ,  &i:iq ,  &i:ii ,
~~~
With the populated table of instructions, implementing a process-single-opcode is easy. This will check the instruction to make sure it's valid, then call the corresponding handler in the instruction table. If not valid, this will report an error.

~~~
:process-single-opcode (n-)
  dup #0 #29 n:between?
  [ &Instructions + fetch call ]
  [ 'Invalid_Instruction:_%n_! s:format s:put nl ] choose ;
~~~
Next is to unpack an instruction bundle and process each instruction.

~~~
:process-packed-opcode (n-)
  unpack
  process-single-opcode
  process-single-opcode
  process-single-opcode
  process-single-opcode ;
~~~
So the guts of the Nga-in-RETRO are done at this point. Next is a method of stepping through execution of a word.

This will display output indicating state. It'll provide:

• current memory location
• values in instruction bundle
• stack depths
• data stack before execution
• data stack after exection
E.g.,

IP:13966 SP:3 RP:1
  [19,0,0,0] - mu......
  Stack: 9 3 3  -> 9 9
So helpers for displaying things:

~~~
:display-data-stack
  'DS:_ s:put
  #0 @SP [ &DataStack over + fetch n:put sp n:inc ] times drop ;

:display-return-stack
  'RS:_ s:put
  #0 @RP [ &ReturnStack over + fetch n:put sp n:inc ] times drop ;
~~~
And then using the display helpers and instruction processor, a single stepper. (This also updates a Steps counter)

~~~
'Steps var

:take-step
  [IP] process-packed-opcode &IP v:inc
  &Steps v:inc ;

{{
  :sep          #63 [ $- c:put ] times nl ;
  :named-word?  @IP d:lookup-xt n:-zero? ;
  :show-name    0; drop @IP d:lookup-xt d:name s:put nl ;
  :instruction  [IP] [ unpack ] sip ;
  :names        #4 [ name-for<counting-li> c:put c:put ] times ;
  :format       '%n,%n,%n,%n s:format ;
  :pad          s:length #16 swap - #0 n:max [ sp ] times ;
  :opcodes      format dup s:put pad ;
  :pad          dup n:to-string s:length #6 swap - #0 n:max [ sp ] times ;
  :header       'IP: s:put @IP pad n:put
                @RP @SP '\tSP:%n_RP:%n\t s:format s:put ;
---reveal---
  :details      instruction drop names tab instruction [ opcodes ] dip sp n:put nl ;
  :stacks       display-data-stack nl display-return-stack nl ;
  :step         sep named-word? show-name header details take-step stacks ;
}}
~~~
And then wrap it with times to run multiple steps.

~~~
:steps (n-)
  &step times ;
~~~
Then on to the tracer. This will step through execution until the word returns. I use a similar approach to how I handle this in the interface layers for RETRO (word execution ends when the address stack depth reaches zero).

The trace will empty the step counter and display the number of steps used.

~~~
:copy-image
  #0 IMAGE IMAGE-SIZE here n:min copy ;
~~~
~~~
:trace (a-)
  copy-image
  #0 !Steps #0 !SP
  !IP #0 >r
  [ step @RP n:zero? @IP n:negative? or ] until
  nl @Steps '%n_steps_taken\n s:format s:put ;
~~~
Tests
~~~
:test
  \liliaddu `22 `33
  #3 #4 gt? [ #1 ] if ;

#0 #100 disassemble
nl '-------------------------- s:put nl
&TryToIdentifyWords v:on
#0 #100 disassemble
~~~
