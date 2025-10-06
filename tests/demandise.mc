##! demandise

let exception |msg = #exception msg;
let print |msg = #print msg;



let map |f = is {
    x::r ?  f |x :: map |f |r;
    []   ?  [];
};

let composeN |n |f = is (n) {
    0 ? val id |x = x;
    n, n>0 ? f . composeN |(n-1) |f;
};

let filter |f = is {
    [] ? [];
    h::t, f |h ? h::filter |f |t;
    _::t ? filter |f |t; 
};

let primesUntil |n = 
    with r = range |2 |n do
    with divides |n |d = n % d == 0 do
    with isPrime |p = none |(divides |p) |(range |2 |p) do
    filter |isPrime |r
;

let even = is {
    0 ? 1; 1 ? 0;
    n, n>0 ? even |(n-2);
    n, n<0 ? even |(n+2);
};

let fold |f |x = is {
    [] ? x;
    h::t ? fold |f |(f |h |x) |t;
};

let fold_ |f = is {
    [] ? exception |"Can't fold_ an empty list";
    [x] ? x;
    h::t ? fold |f |(f |h |x) |t;
};

let add |a |b = a+b;
let sum = fold |add |0;

let nth |n = is {
    [] ? exception |"Index exceeded list bounds";
    h::_, n==0 ? h;
    _::t ? nth |(n-1) |t;
};

let range |a |b = is (a) {
    a, a>=b ? [];
    a ? a::range |(a+1) |b;
};

let length = is {
    [] ? 0;
    _::t ? 1+length |t;
};

let last = is {
    [] ? exception |"List was empty, can't retrieve last element.";
    [x] ? x;
    _::t ? last |t;
};

let none |f = is {
    [] ? true;
    x::_, f |x ? false;
    _::t ? none |f |t;
};

let fact |(n, n>=0) = is (n) {
    0 ? 1;
    n ? n*fact |(n-1);
};

let _ = print $ fact |(fact |4);
let _ = print $ primesUntil |300;

