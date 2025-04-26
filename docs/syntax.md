
```
#########################################
#########################################
#####     MICRO SYNTAX REFERENCE    #####     
#########################################
#########################################


## Comments start with '##' and end at the line break, or are wrapped inside a #- -#
## pair for multiline comments.

## If something seems unclear, it might be because it has a (?) next to it, meaning : 
## don't worry, it'll be expanded upon in the handbook.

## Micro syntax has no semantics attached to it, so what we're describing here purely
## is how Micro parses expressions, and nothing else.



#########################################
###           BASIC SYNTAX            ###
#########################################

## A Micro script is a sequence of expressions, separated by semicolons. 
## The last semicolon of a script is optional (and, generally speaking, 
## the last semicolon of everything is)

## An expression is made out of operators and operands :

## + applied to a and b.
a+b;                         

## While symbolic operators do the trick most of the time, Micro also provides hash operators. 
## These are regular operators but they start with an '#' (hence the name) followed by letters.
## For instance, this is the operator #in applied to elem and list :
elem #in list;


## If * has higher precedence (?) than + :
1+2*3 <=> 1+(2*3);
1*2+3 <=> (1*2)+3;

## If + and - have the same precedence :
1+2-3 <=> (1+2)-3;
1-2+3 <=> (1-2)+3;


## Micro packs together operands to a same operator, so :
1+2+3;
## Is neither (1+2)+3, nor 1+(2+3), but the operator + applied to 1, 2 and 3 at the same time
## effectively turning + into a ternary (3-operands) operator here.

## The explicit pack syntax is handy syntactic sugar meaning the exact same thing.
[#op a;b;c;...;z]; <=> a #op b #op c #op ... #op z


## Micro also allows unary operators in a prefix form :
#print 0;


## Should you want to apply an operator to nothing (nullary operators, i.e operators taking no operands), 
## you have to enclose it in square brackets :
?;        ## No, "Expression expected."
[?];      ## Yes


## Operator arity (?) is enforced when parsed. So if + is declared with an arity of 2 :
1+2;    ## Yes
1+2+3;  ## No
+1;     ## No




#########################################
###        IMPLICIT OPERATORS         ###
#########################################

## Some operators are implicitely generated, starting
## with the '#list' one.
[a;b;c] <=> [#list a;b;c];
[a] <=> [#list a];
[] <=> [#list];

## Similarly, we also have #tuple :
(a;b;c) <=> [#tuple a;b;c];
(a;) <=> [#tuple a];    ## Warning, without the ';', it's understood as a simple parenthesized expression !
() <=> [#tuple];


## Next up are #call...
f(x;y;z) <=> [#call f;x;y;z];
f(x) <=> [#call f;x];
f() <=> [#call f];

## ...and #index.
array[0;10] <=> [#index array;10];
array[0] <=> [#index array;0] <=> array #index 0;
array[] <=> [#index array];

## Note that the thing that's called/indexed can be anything :
(obj.method)(x) <=> [#call object.method;x];
("hello, " + "world !")[0] <=> [#index "hello, "+"world !";0];

## The precedence of #call and #index respectively are used to determine what is called/indexed
## For instance, if + has lower precedence than #index, then :
a+b[0] <=> a+(b[0])

## But if . has higher precedence than #call, then :
a.b() <=> (a.b)()



## Literals (?) also are, in fact, implicitely generated operators.
## When a literal is encountered, it's wrapped inside the corresponding operator :
0 <=> [#number `0`];
"hi !" <=> [#string `hi !`];
x <=> [#name `x`];


#########################################
###              MACROS               ###
#########################################


## Any part of an expression can be replaced by a macro call. The syntax is the following :
macro(arg1; ...; argn) {
    stmt1;
    ...;
    stmtn;
};
## Where argi as well as stmti can be any valid expression, including other macros.

## Line breaks and spaces are irrelevant, so this is fine as well :
macro(
    arg1; 
    ...; 
    argn;
) { stmt1; ...; stmtn };

## The argument list is called the head, the statement list the body.


## Macros can be used in conjunction with standard operators :
1 + compute(...) { ... };       ## Applying + to 1 and the result of the compute macro.
x #in computeList(...) { ... }  ## Same with the #in operator.



## Macro syntax can be a little bit lighter than that.
## If no argument is provided, the parentheses are optional :
loop {
    ...
}

## If the body is made of one single statement, you can drop the brackets :
if (true) doThis();

## Both rules hold at the same time ("inline macro"):
return x <=> return() { x };

## Beware, parentheses after the macro name are always understood as the argument list. Hence :
return (0;0)       ## ERROR, '{' or inline body expected.
return {(0;0)}     ## OK


## You can enforce a specific syntax for a macro by providing a 'mode' flag to the macro declaration (?)
## That mode can be one of the following : block, inline and half-inline

## - block : no restrictions whatsoever
macro() { stmt1; stmt2 }    ## OK
macro { stmt1; stmt2 }      ## OK
macro() stmt                ## OK
macro stmt                  ## OK

## - inline : body must be inline or a single expression enclosed in brackets
## Furthermore, if arity is exactly 0, then parentheses have to be dropped.
macro stmt                      ## OK
macro { stmt }                  ## OK
macro { stmt1; stmt2 }          ## NO, can't have an inline body.
macro { stmt; }                 ## NO, can't have a semicolon at the end of a single-expression body.
macro() stmt                    ## NO, can't have parentheses here.
myOneArityMacro(hi) stmt        ## OK
myZeroToOneArityMacro() stmt    ## Ok because arity must be exactly 0 to forbid parentheses.

## - half-inline : macro limbs (see next paragraph) must be inline or a single expression 
## enclosed in brackets. No restrictions on the body. If arity is 0, parentheses must be dropped.


## Should you ever need what looks like a zero-length macro, like "break;" or 
## some 'true' literal, you should consider using #name manipulation (?) or nullary operators instead.


#########################################
###        SPECIAL MACRO FORMS        ###
#########################################


## Macros have support for things called limbs :
if (true) {
    doSomething();      ## The standard macro body
} else {
    doSomethingElse();  ## An else limb
};

## Limbs must always be in the right order, but some can be omitted. 
## For instance, if the macro is declared as try with limbs catch and finally :
try { };                        ## Ok
try { } finally { };            ## Ok
try { } catch { } finally { };  ## Ok
try { } finally { } catch { };  ## No


## Using a pair of curly brackets alone is understood as calling 
## a macro named '' (empty string).
{}

## Optionnaly, statements can be put inside, which will be the body of that macro.
{ x;y;z }

## Just like a regular macro, those statements can be any valid expression.


## Last but not least, if a ' (termed "binding tick") follows a macro name,
## it triggers the bound macro behavior :

function' f(x; y; z) { 
    ... 
} 

    <=> 

function'(`f`;x;y;z) { 
    ... 
};

## i.e the name following it is passed as a literal as the first argument to the macro.
## Notice that said macro is not "function" here, but "function'" : The binding tick is 
## part of the name of the macro, and :

x = function() { ... };
function' x() { ... };  

## result in two effectively different macro calls (to function and function' respectively).



#########################################
###               RECAP               ###
#########################################

## Here's a sample script that recaps everything we've seen until here :

## Bound macro function'
function' getCommandLineArgs() {

    ## Inline macro let + nullary operator #commandlineargs
    let args = [#commandlineargs];

    ## Operator '!!' (here, meant as "ensure that") used in a prefix fashion
    ## along with an implicit #index and a #string literal
    !! args[0] == "myProgram";
    !! #length args == 2;

    ## Another inline macro return
    return args
};


## #calling getCommandLineArgs
let args = getCommandLineArgs(); 

## if macro
if ("--plot" #in args) {
    ## Explicit pack on #bezier and implicit #tuples.
    let myBezierCurve = [#bezier (0;0);(1/2;1);(0;1)];

    ## Ploting with unary operator #plot
    #plot myBezierCurve;
} 

## else limb, its body being a single if macro
else if ("--game" #in args) {

    print("Let's play a guessing game !");

    ## Using the silent macro as some kind of object literal, along with a syntactic ':' operator
    let state = { attempts: 0; secret: [? 1;100] };

    while (true) {
        let guess = parseFloat(getInput("Enter a guess :"));

        ## Two macros, when & do, with an arity of 0
        when {
            guess > state.secret -> do {
                print("It's lower than that !");
                ++state.attemps;  ## Remember there is no such things as suffix operators in Micro
            };
            guess < state.secret -> do {
                print("It's bigger than that !");
                ++state.attemps;
            };
            guess == state.secret -> do {
                ## + will be applied to the two strings and state.attempts at the same time.
                print("Congratulations, you won in " + state.attempts + "attempts !");
                #exit 0;
            }
        }
    }
}


## Note that here, the syntax is very similar to Javascript's on purpose, 
## but it's totally possible to stray far away from it if you wish ; 
## in fact, Micro was designed precisely for when Javascript (or python,
## or whatever) was not able to concisely express some kind of behavior or data :


movement' jump(height; duration) {
    [#moveAlong (0;height/2); duration/2] ~ [#quickStart];  ## Adding #quickStart for non-linear movement
    [#moveAlong (0;-height/2); duration/2] ~ [#slowStart];  ## Same here
}

animation' main {
    pnj1 : setPos((-100;0)), jump(50; 1), wait(0.5);
    pnj2 : setPos((100;0)), wait(0.5), jump(50; 1);
}

```


