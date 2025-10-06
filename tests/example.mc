##! js-mock

## inline import macro with a from limb
import (display; input) from "io";


## A declaration macro
function getCommandLineArgs() {
    ## Nullary operator #commandlineargs
    ## We use a literal to pass the variable name "args" instead of its value to =,
    ## i.e here we want to prevent #name to be invoked.
    'args = #commandlineargs;

    ## Operator '!!' (here, meant as "ensure that") used in a prefix fashion
    ## along with an implicit #index and a #string literal
    !! args[0] == "myProgram";
    !! #length args == 2;

    ## Another inline macro
    return args;
};


## #call-ing getCommandLineArgs
'args = getCommandLineArgs(); 

## if macro
if ("--plot" #in args) {
    ## Explicit pack on #bezier and implicit #tuples
    'myBezierCurve = [#bezier (0;0);(1/2;1);(0;1)];

    ## Ploting with unary operator #plot
    #plot myBezierCurve;
} 

## else limb, its body being a single if macro
else if ("--game" #in args) {

    display("Let's play a guessing game !");

    ## Using the silent macro as some kind of object literal, along with a syntactic ':' operator
    'state = { attempts: 0; secret: [? 1;100] };

    while (true) {
        guess = parseFloat(getInput("Enter a guess :"));

        ## Two macros, when & do, with an arity of 0
        when {
            guess > state.'secret -> do {
                display("It's lower than that !");
            };
            guess < state.'secret -> do {
                display("It's bigger than that !");
            };
            guess == state.'secret -> do {
                ## String formatting 
                display("Congratulations, you won in {state.'attempts} attempts !");
                #exit 0;
            }
        }
        
        ## Inline macro incr
        incr state.'attempts; 
    }
}


