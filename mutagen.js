/* Mutagen: a text generator library
   Written by Andrew Plotkin <erkyrath@eblong.com>
   This Javascript code is copyright 2009-2011 by Andrew Plotkin. You may
   copy, distribute, and modify it freely, by any means and under any
   conditions.

   Mutagen is a simple Javascript library for generating pseudorandom
   strings of text, according to a grammar.

   By "pseudorandom", we mean that if you put in a number, you'll get out
   an apparently arbitrary string. If you put in a different number, you'll
   get out a different string. But if you put in the same number twice,
   you'll get the same string out both times. The generation algorithm
   is completely deterministic; the number acts as a seed.

   (The algorithm is patternless enough for ordinary use, but it's not
   a strong pseudorandom function. It's basically a lot of
   ((SEED mod P) mod C), where P is a prime near 5000, and C is the
   list of choices at a given point -- perhaps as few as two.)


   * Usage

   To use this library, define a node -- meaning a plain string, or
   one of the node types described below. This defines a "grammar", in
   the comp-sci sense: a structure of possible string outputs. Then
   do:

   var factory = Factory(NODE);
   var str = factory(seed);

   You can call the factory() function as often as you like, with
   various seeds.

   See the goreyfate.js source file for an example of use.

   * Nodes

   These are the various kinds of node:

   - "string"

   A plain string. It always generates itself, regardless of the seed.
   
   - null

   This generates nothing; it has no effect. Sometimes that's handy.
   The empty string "" is equivalent.

   - Sequence(NODE, NODE, NODE, ...)

   A sequence of nodes. It generates each node in turn. (Again, the
   seed value has no effect.) 

   For example, the node Sequence("hello", "there", "world")
   would always generate the string "Hello there world." (Note that
   you get the initial capital letter, final period, and spaces for
   free.)

   A sequence can contain any other nodes, not just plain strings. So
   you could define Sequence(Sequence("hello", "there"), "world")
   and get the same result, "Hello there world."

   - Choice(NODE, NODE, NODE, ...)

   A random (or rather, pseudorandom) choice of nodes. This generates
   exactly one of the node arguments, as determined by the seed. So
   Choice("red", "green", "blue") would generate either "Red." or
   "Green." or "Blue."

   A Choice can contain Sequences and a Sequence can contain Choices.
   That gives you most of the system right there. Everything else is
   details.
   
   - Shuffle(NODE, NODE, NODE, ...)

   Like a Choice, but if you call it twice in the same output, it tries
   not to generate the same choice twice. (It will occasionally happen,
   if you call it more times than it has choices.)

   So, if you define X=Shuffle("one", "two", "three"), then 
   Sequence(X, X) might return "One two." or "Two three." but not
   "One one." or "Three three."

   - Weighted(NUM, NODE, NUM, NODE, ...)

   This is like a Choice, but with unequal probabilities. If you define
   Weighted(2, "human", 1, "elf", 1, "dwarf") you'd get a 50% chance
   of "Human." and a 25% chance of each of the other two options.

   For tedious reasons (meaning, I was lazy) all of the numbers must be
   integers. Fractional values won't work right.

   - Fixed(LABEL, NODE)

   Sometimes you want random choices that line up. For example, you
   might define Choice("aunt", "uncle") at one point in your grammar,
   and Choice("Harriet", "Harold") at another point. But these are not
   independent choices; you don't want "Aunt Harold" or "Uncle Harriet".

   To solve this problem, use Fixed("gender", Choice(...)). This applies
   the label "gender" (for this example) to the Choice node. All Choices
   with the same label will wind up making the same selection, for a given
   seed. Either they'll all choose their first argument, or they'll all
   choose their second argument, or whatever.

   (Make sure all the Choices for a given label have the same number
   of options! Otherwise, all bets are off. You can wrap Weighted
   nodes too, but again, they have to have the same number of options,
   and the same weight values too.)
   
   - Period

   This node generates a period, and causes the next word to be capitalized.
   (Putting a Period at the very end of your grammar is optional.)

   - Comma
   - Semicolon
   - Dash

   More ways to generate punctuation.

   If you put two punctuation marks in a row, the stronger one eats the 
   weaker. That is, Sequence("hello", Comma, Period, "goodbye") will
   generate "Hello. Goodbye." This can be handy for chaining several
   phrases together.

   - AAn

   This node generates "a" or "an", depending on whether the next word
   starts with a vowel.

   - Concat

   This node generates nothing, and skips the space that would normally
   appear before the next node.


   * Internals

   For some reason, I wrote this library in (nearly) purely functional
   Javascript. Go ahead, laugh.

   This means it's a big pile of closures, and functions that return
   functions that return functions. If you're a Lisp programmer, it
   will be obvious how it works. To everyone else, I apologize. Take
   it as a learning experience.

   (The "nearly" is because a few of the operations require state.
   In particular, Shuffle has to keep track of which choices have
   been generated already.)


   * Future Directions

   This library is a weekend hack, and I don't expect to expand it.
   However, there are some obvious improvements to be made.

   Primarily, some kind of versioning system. These generators are
   fragile with respect to grammar changes. That is, if you know
   that factory(1000000) produces a particular string, but then you
   think of some extra Choices to throw in, the new factory(1000000)
   could be a completely different string -- even though you only
   added possibilities, not removed any.

   For some uses, of course -- like a silly button on a web page --
   that doesn't matter. But if you used this in a persistent game,
   you might want to store a seed value and have it generate the
   same string forever. That would require some kind of versioning
   model.

   Another thing: this system is profligate with primes, and it has
   a limited stock built in. This means that, as you develop your
   grammar, you have to paste in more primes now and then. This is
   silly. Really there is a lot of opportunity for re-using primes;
   the various children of a Choice could all use the same cycle
   value, because they will never occur in the same output. (Unless
   the Choice is used more than once... but that way lies graph
   theory.)

   (For that matter, the system wastes primes on Sequence nodes, which
   don't use them. A bit of refactoring would take care of that.)
*/

/* A handful of special nodes which contain no code. These exist only
   to be compared via identity (===). 
*/
Period = Object();
Semicolon = Object();
Dash = Object();
Comma = Object();
AAn = Object();
Concat = Object();

/* All the Node types -- except the special cases above -- are functions
   that return functions that return functions. You, the user, call the
   function with a set of arguments. You get back a node function. The
   Factory calls that to bind in the prime number (which will be used
   during generation); it gets back a generator function. Finally,
   the node's parent calls the generator, passing in the seed and a
   work array of strings. The generator appends its output to the
   work array.

   I know; in a real functional language, the generator should return
   a consed result, instead of appending to the work array. Live with
   it. Javascript isn't *that* functional.
*/

function Sequence(/*...*/) {
    var argcopy = Array.prototype.slice.call(arguments);

    return function(build, cycle) {
        var argls = Array();
        for (var ix=0; ix<argcopy.length; ix++) {
            var bfunc = build(argcopy[ix]);
            argls.push(bfunc);
        }

        return function(resarray, seed) {
            for (var ix=0; ix<argls.length; ix++) {
                var bfunc = argls[ix];
                bfunc(resarray, seed);
            }
        }
    }
}

function Choice(/*...*/) {
    var argcopy = Array.prototype.slice.call(arguments);

    return function(build, cycle) {
        var argls = Array();
        for (var ix=0; ix<argcopy.length; ix++) {
            var bfunc = build(argcopy[ix]);
            argls.push(bfunc);
        }

        return function(resarray, seed) {
            var ix = (seed % cycle) % argls.length;
            var bfunc = argls[ix];
            bfunc(resarray, seed);
        }
    }
}

function Shuffle(/*...*/) {
    var argcopy = Array.prototype.slice.call(arguments);

    var order = [];
    var seedstore = [-1];

    return function(build, cycle) {
        var argls = Array();
        for (var ix=0; ix<argcopy.length; ix++) {
            var bfunc = build(argcopy[ix]);
            argls.push(bfunc);
        }

        return function(resarray, seed) {
            if (seed != seedstore[0]) {
                order.length = 0;
                seedstore[0] = seed;
            }
            if (order.length == 0) {
                for (var ix=0; ix<argls.length; ix++) {
                    order.push(argls[ix]);
                }
                for (var ix=0; ix<argls.length; ix++) {
                    var jx = (seed % (cycle+2*ix)) % argls.length;
                    var tmp = order[ix];
                    order[ix] = order[jx];
                    order[jx] = tmp;
                }
            }
            var bfunc = order.pop();
            bfunc(resarray, seed);
        }
    }
}

function Weighted(/*...*/) {
    var argcopy = Array.prototype.slice.call(arguments);

    return function(build, cycle) {
        var argls = Array();
        var total = 0;
        for (var ix=0; ix<argcopy.length; ix+=2) {
            var weight = argcopy[ix];
            var bfunc = build(argcopy[ix+1]);
            total += weight;
            argls.push(weight);
            argls.push(bfunc);
        }

        return function(resarray, seed) {
            var val = (seed % cycle) % total;
            for (var ix=0; ix<argls.length; ix+=2) {
                if (val < argls[ix]) {
                    var bfunc = argls[ix+1];
                    bfunc(resarray, seed);
                    break;
                }
                val -= argls[ix];
            }
        }
    }
}

function Fixed(label, node) {
    return function(build, cycle) {
        var bfunc = build(node, label);
        return function(resarray, seed) {
            bfunc(resarray, seed);
        }
    }
}

/* Builder is a utility function used by the Factory. Actually, this
   Builder() function *generates* that utility function. It builds in
   a stock of prime numbers, and a table of labels to be used for
   Fixed nodes.
*/

function Builder() {
    var primelist = [
 5009, 5011, 5021, 5023, 5039, 5051, 5059, 5077, 5081, 5087,
 5099, 5101, 5107, 5113, 5119, 5147, 5153, 5167, 5171, 5179,
 5189, 5197, 5209, 5227, 5231, 5233, 5237, 5261, 5273, 5279,
 5281, 5297, 5303, 5309, 5323, 5333, 5347, 5351, 5381, 5387,
 5393, 5399, 5407, 5413, 5417, 5419, 5431, 5437, 5441, 5443,
 5449, 5471, 5477, 5479, 5483, 5501, 5503, 5507, 5519, 5521,
 5527, 5531, 5557, 5563, 5569, 5573, 5581, 5591, 5623, 5639,
 5641, 5647, 5651, 5653, 5657, 5659, 5669, 5683, 5689, 5693,
 5701, 5711, 5717, 5737, 5741, 5743, 5749, 5779, 5783, 5791,
 5801, 5807, 5813, 5821, 5827, 5839, 5843, 5849, 5851, 5857,
 5861, 5867, 5869, 5879, 5881, 5897, 5903, 5923, 5927, 5939,
 5953, 5981, 5987, 6007, 6011, 6029, 6037, 6043, 6047, 6053,
 6067, 6073, 6079, 6089, 6091, 6101, 6113, 6121, 6131, 6133,
 6143, 6151, 6163, 6173, 6197, 6199, 6203, 6211, 6217, 6221,
 6229, 6247, 6257, 6263, 6269, 6271, 6277, 6287, 6299, 6301,
 6311, 6317, 6323, 6329, 6337, 6343, 6353, 6359, 6361, 6367,
 6373, 6379, 6389, 6397, 6421, 6427, 6449, 6451, 6469, 6473,
 6481, 6491, 6521, 6529, 6547, 6551, 6553, 6563, 6569, 6571,
 6577, 6581, 6599, 6607, 6619, 6637, 6653, 6659, 6661, 6673,
 6679, 6689, 6691, 6701, 6703, 6709, 6719, 6733, 6737, 6761,
 6763, 6779, 6781, 6791, 6793, 6803, 6823, 6827, 6829, 6833,
 6841, 6857, 6863, 6869, 6871, 6883, 6899, 6907, 6911, 6917,
 6947, 6949, 6959, 6961, 6967, 6971, 6977, 6983, 6991, 6997,
 7001, 7013, 7019, 7027, 7039, 7043, 7057, 7069, 7079, 7103,
 7109, 7121, 7127, 7129, 7151, 7159, 7177, 7187, 7193, 7207,
 7211, 7213, 7219, 7229, 7237, 7243, 7247, 7253, 7283, 7297,
 7307, 7309, 7321, 7331, 7333, 7349, 7351, 7369, 7393, 7411,
 7417, 7433, 7451, 7457, 7459, 7477, 7481, 7487, 7489, 7499,
 7507, 7517, 7523, 7529, 7537, 7541, 7547, 7549, 7559, 7561,
 7573, 7577, 7583, 7589, 7591, 7603, 7607, 7621, 7639, 7643,
 7649, 7669, 7673, 7681, 7687, 7691, 7699, 7703, 7717, 7723,
 7727, 7741, 7753, 7757, 7759, 7789, 7793, 7817, 7823, 7829,
 7841, 7853, 7867, 7873, 7877, 7879, 7883, 7901, 7907, 7919,
 7927, 7933, 7937, 7949, 7951, 7963, 7993, 8009, 8011, 8017,
 8039, 8053, 8059, 8069, 8081, 8087, 8089, 8093, 8101, 8111,
 8117, 8123, 8147, 8161, 8167, 8171, 8179, 8191, 8209, 8219,
 8221, 8231, 8233, 8237, 8243, 8263, 8269, 8273, 8287, 8291,
 8293, 8297, 8311, 8317, 8329, 8353, 8363, 8369, 8377, 8387,
 8389, 8419, 8423, 8429, 8431, 8443, 8447, 8461, 8467, 8501,
 8513, 8521, 8527, 8537, 8539, 8543, 8563, 8573, 8581, 8597,
 8599, 8609, 8623, 8627, 8629, 8641, 8647, 8663, 8669, 8677,
 8681, 8689, 8693, 8699, 8707, 8713, 8719, 8731, 8737, 8741,
 8747, 8753, 8761, 8779, 8783, 8803, 8807, 8819, 8821, 8831,
 8837, 8839, 8849, 8861, 8863, 8867, 8887, 8893, 8923, 8929,
 8933, 8941, 8951, 8963, 8969, 8971, 8999, 9001, 9007, 9011,
 9013, 9029, 9041, 9043, 9049, 9059, 9067, 9091, 9103, 9109,
 9127, 9133, 9137, 9151, 9157, 9161, 9173, 9181, 9187, 9199,
 9203, 9209, 9221, 9227, 9239, 9241, 9257, 9277, 9281, 9283,
 9293, 9311, 9319, 9323, 9337, 9341, 9343, 9349, 9371, 9377,
 9391, 9397, 9403, 9413, 9419, 9421, 9431, 9433, 9437, 9439,
 9461, 9463, 9467, 9473, 9479, 9491, 9497, 9511, 9521, 9533,
 9539, 9547, 9551, 9587, 9601, 9613, 9619, 9623, 9629, 9631,
 9643, 9649, 9661, 9677, 9679, 9689, 9697, 9719, 9721, 9733,
 9739, 9743, 9749, 9767, 9769, 9781, 9787, 9791, 9803, 9811,
 9817, 9829, 9833, 9839, 9851, 9857, 9859, 9871, 9883, 9887,
 9901, 9907, 9923, 9929, 9931, 9941, 9949, 9967, 9973, 10007,
 10009, 10037, 10039, 10061, 10067, 10069, 10079, 10091, 10093, 10099,
 10103, 10111, 10133, 10139, 10141, 10151, 10159, 10163, 10169, 10177,
 10181, 10193, 10211, 10223, 10243, 10247, 10253, 10259, 10267, 10271,
 10273, 10289, 10301, 10303, 10313, 10321, 10331, 10333, 10337, 10343,
 10357, 10369, 10391, 10399, 10427, 10429, 10433, 10453, 10457, 10459,
 10463, 10477, 10487, 10499, 10501, 10513, 10529, 10531, 10559, 10567,
 10589, 10597, 10601, 10607, 10613, 10627, 10631, 10639, 10651, 10657,
 10663, 10667, 10687, 10691, 10709, 10711, 10723, 10729, 10733, 10739,
 10753, 10771, 10781, 10789, 10799, 10831, 10837, 10847, 10853, 10859,
 10861, 10867, 10883, 10889, 10891, 10903, 10909, 10937, 10939, 10949,
 10957, 10973, 10979, 10987, 10993, 11003, 11027, 11047, 11057, 11059,
 11069, 11071, 11083, 11087, 11093, 11113, 11117, 11119, 11131, 11149,
 11159, 11161, 11171, 11173, 11177, 11197, 11213, 11239, 11243, 11251,
 11257, 11261, 11273, 11279, 11287, 11299, 11311, 11317, 11321, 11329,
 11351, 11353, 11369, 11383, 11393, 11399, 11411, 11423, 11437, 11443,
 11447, 11467, 11471, 11483, 11489, 11491, 11497, 11503, 11519, 11527,
 11549, 11551, 11579, 11587, 11593, 11597, 11617, 11621, 11633, 11657,
 11677, 11681, 11689, 11699, 11701, 11717, 11719, 11731, 11743, 11777,
 11779, 11783, 11789, 11801, 11807, 11813, 11821, 11827, 11831, 11833,
 11839, 11863, 11867, 11887, 11897, 11903, 11909, 11923, 11927, 11933,
 11939, 11941, 11953, 11959, 11969, 11971, 11981, 11987, 12007, 12011,
 12037, 12041, 12043, 12049, 12071, 12073, 12097, 12101, 12107, 12109,
 12113, 12119, 12143, 12149, 12157, 12161, 12163, 12197, 12203, 12211,
 12227, 12239, 12241, 12251, 12253, 12263, 12269, 12277, 12281, 12289,
 12301, 12323, 12329, 12343, 12347, 12373, 12377, 12379, 12391, 12401,
 12409, 12413, 12421, 12433, 12437, 12451, 12457, 12473, 12479, 12487,
 12491, 12497, 12503, 12511, 12517, 12527, 12539, 12541, 12547, 12553,
 12569, 12577, 12583, 12589, 12601, 12611, 12613, 12619, 12637, 12641,
 12647, 12653, 12659, 12671, 12689, 12697, 12703, 12713, 12721, 12739,
 12743, 12757, 12763, 12781, 12791, 12799, 12809, 12821, 12823, 12829,
 12841, 12853, 12889, 12893, 12899, 12907, 12911, 12917, 12919, 12923,
 12941, 12953, 12959, 12967, 12973, 12979, 12983, 13001, 13003, 13007,
 13009, 13033, 13037, 13043, 13049, 13063, 13093, 13099, 13103, 13109,
 13121, 13127, 13147, 13151, 13159, 13163, 13171, 13177, 13183, 13187,
 13217, 13219, 13229, 13241, 13249, 13259, 13267, 13291, 13297, 13309,
 13313, 13327, 13331, 13337, 13339, 13367, 13381, 13397, 13399, 13411,
 13417, 13421, 13441, 13451, 13457, 13463, 13469, 13477, 13487, 13499,
 13513, 13523, 13537, 13553, 13567, 13577, 13591, 13597, 13613, 13619 
                     ];

    var fixedmap = {};
    

    buildfunc = function(node, label) {
        var cycle;

        if (!node) {
            return function(resarray, seed) { };
        }
        if (typeof(node) == 'string') {
            return function(resarray, seed) {
                resarray.push(node);
            };
        }
        if (node === Period || node === Comma || node === Dash 
            || node === Semicolon || node === AAn || node === Concat) {
            return function(resarray, seed) {
                resarray.push(node);
            };
        }
        
        if (!label) {
            cycle = primelist.pop();
        }
        else {
            if (!(label in fixedmap)) {
                cycle = primelist.pop();
                fixedmap[label] = cycle;
            }
            else {
                cycle = fixedmap[label];
            }
        }
        if (!cycle)
            throw "Out of cycle primes";
        return node(arguments.callee, cycle);
    }
    return buildfunc;
}

function Factory(node) {
    /* Generate a builder for use with this factory. */
    var bfunc = Builder()(node);

    /* Some constants, used when stringing together words. */
    var Mode_Beginning = 0;
    var Mode_NewSentence = 1;
    var Mode_Interword = 2;
    var Mode_Comma = 3;
    var Mode_Semicolon = 4;
    var Mode_Dash = 5;
    var Mode_AAn = 6;
    var Mode_Concat = 7;

    /* Regex to test whether a string starts with a vowel. */
    var regex_startvowel = /^[aeiou]/i;

    /* Build and return the factory function. */
    return function(seed) {
        /* Call the nested generators, filling in the work array. */
        var resarray = Array();
        bfunc(resarray, seed);

        /* Now we have to go down the work array and account for
         capitalization, spaces, "a/an" distinctions, etc. We do
         this in a second work array. */

        var outarray = Array();
        var mode = Mode_Beginning;
        
        for (var ix=0; ix<resarray.length; ix++) {
            var val = resarray[ix];
            if (!val)
                continue;

            var nextmode = Mode_Interword;

            if (val === Period) {
                mode = Mode_NewSentence;
                continue;
            }
            if (val === Comma) {
                if (mode == Mode_Interword)
                    mode = Mode_Comma;
                continue;
            }
            if (val === Dash) {
                if (mode == Mode_Interword || mode == Mode_Comma)
                    mode = Mode_Dash;
                continue;
            }
            if (val === Semicolon) {
                if (mode == Mode_Interword || mode == Mode_Comma || mode == Mode_Dash)
                    mode = Mode_Semicolon;
                continue;
            }
            if (val === Concat) {
                mode = Mode_Concat;
                continue;
            }
            if (val === AAn) {
                val = "a";
                nextmode = Mode_AAn;
            }

            if (mode == Mode_Beginning || mode == Mode_NewSentence) {
                val = val.substr(0, 1).toUpperCase() + val.substr(1);
            }

            switch (mode) {
            case Mode_Concat:
                break;
            case Mode_Interword:
                outarray.push(" ");
                break;
            case Mode_Comma:
                outarray.push(", ");
                break;
            case Mode_Semicolon:
                outarray.push("; ");
                break;
            case Mode_Dash:
                outarray.push(" -- ");
                break;
            case Mode_AAn:
                if (regex_startvowel.test(val))
                    outarray.push("n");
                outarray.push(" ");
                break;
            case Mode_NewSentence:
                outarray.push(". ");
                break;
            }

            outarray.push(val);
            mode = nextmode;
        }
        
        /* Add a period if needed. */
        if (!(mode == Mode_Beginning || mode == Mode_NewSentence)) {
            outarray.push(".");
        }

        /* The outarray is a simple array of strings to be joined
           together. */
        return outarray.join("");
    }
}
