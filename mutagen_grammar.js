/*
Parse Mutagen grammars from a hopefully human-friendly format.
Then have them generate random text.
XXX incompletely translated from python
*/

var punct = {'.': Period,
//             '?': terminator('?'),
//             '!': terminator('!'),
             ',': Comma,
             ';': Semicolon,
//             '-': sequence(abut, literal('-'), abut),
             '--': Dash};
function mkPunct(s) { return punct[s]; }

function mutagenParse(grammar) {

    var rules = {'-a-': AAn,
                 '-an-': AAn,
                 '-a-an-': AAn,
                 '-adjoining-': Concat,
//                 '-capitalize-': capitalize
                };

    var parser = parseGrammar("            \
grammar = _ rules                          \
rules   = rule rules |                     \
                                           \
rule    = name [=] _ exp       setDefn     \
                                           \
exp     = alts                 mkChoice    \
alts    = alt [/] _ alts                   \
        | alt                              \
alt     = \\[ number \\] _ seq mkWeight    \
        | seq                  mkUnit      \
seq     = factor seq           mkSeq       \
        |                      mkEmpty     \
factor  = name ![=]            mkRef       \
        | punct                mkPunct     \
        | [(] _ exp [)] _                  \
        | { _ alts } _         mkShuffle   \
        | word { _ alts } _    mkFixed     \
        | word                 mkLiteral   \
punct   = ([.,;]) _                        \
        | (--)\\s _                        \
word    = ([A-Za-z0-9']+) _                \
                                           \
name    = (-[A-Za-z0-9'-]+-) _             \
number  = (\\d+) _             int         \
_       = \\s*                             \
", 
               {hug: hug,
                int: parseInt,
                setDefn: function(name, defn) {
                    rules[name] = defn;
                    return [name, defn];
                },
                mkChoice : function() { return myWeighted.apply(null, arguments); },
                mkEmpty  : function() { return null; },
                mkFixed  : function (tag) { return Fixed(tag, myWeighted.apply(null, Array.prototype.slice.call(arguments, 1))); },
                mkLiteral: function(s) { return s; },
                mkPunct  : mkPunct,
//                mkRef    : function(name) { return delay(function() { assert(isOK(rules[name])); return rules[name]; }); },
                mkRef    : function(name) { assert(isOK(rules[name])); return rules[name]; },
                mkSeq    : Sequence,
                mkShuffle: function() { return myShuffle.apply(null, arguments); },
                mkUnit   : function(p) { return [p, 1]; },
                mkWeight : function(w, p) { return [p, w]; },
               });

    var pairs = parser(grammar);
//    console.log(pairs);
    for (var i = 0; i < pairs.length; ++i) {
        if (typeof(pairs[i][1]) !== 'function')
            throw new Error("oops: " + pairs[i][0] + ': ' + pairs[i][1] );
//        rules[pairs[i][0]] = pairs[i][1];
    }
    return rules;
}

function assert(flag) {
    if (!flag)
        throw new Error("assertion error");
}

function delay(thunk) {
    var f = function() {
        f = thunk();
        return f.call(null, arguments);
    };
    return f;
}

function myWeighted() {
    var args = [];
//    console.log('myWeighted takes', arguments);
    for (var i = 0; i < arguments.length; ++i) {
        args.push(arguments[i][1]);
        assert(isOK(arguments[i][0]));
        args.push(arguments[i][0]);
    }
//    console.log('myWeighted', args);
    return Weighted.apply(null, args);
}

// Mutagen's Shuffle() only takes an unweighted set of nodes as arguments,
// but my grammar would give it a set of nodes with weights.
function myShuffle() {
    var nodes = [];
    for (var i = 0; i < arguments.length; i += 2) {
        assert(isOK(arguments[i][1]));
        nodes.push(arguments[i][1]);
    }
    return Shuffle.apply(null, nodes);
}

// Translated from http://www.eblong.com/zarf/mutagen/goreyfate.js
//   GoreyFate: a Mutagen example.
//   Written by Andrew Plotkin <erkyrath@eblong.com>
//   This Javascript code is copyright 2009 by Andrew Plotkin. You may
//   copy, distribute, and modify it freely, by any means and under any
//   conditions.
eg = "   \
-female-name- = Emmalissa / Chloe / Tiffani / Eunice / Zoe / Jennifer / Imelda / Yvette / Melantha   \
-male-name- = Bernard / Joseph / Emmett / Ogden / Eugene / Xerxes / Joshua / Lemuel / Etienne   \
-name- = gender{ -male-name- / -female-name- }   \
-he-she- = gender{ he / she }   \
-person-adjective- = precocious / unflappable / energetic / forceful / inimitable / daring / mild / intense / jaded   \
-intensifier- = great / some / considerable / not inconsiderable / distinct / impressive / unique / notable   \
-neutral-descriptor- = toddler / aesthete / writer / artist   \
-male-descriptor- = stalwart / gentleman / boy / youth   \
-female-descriptor- = young miss / girl / maiden / flapper   \
-descriptor- = [1] -neutral-descriptor- / [1] (gender{ -male-descriptor- / -female-descriptor- })   \
-descriptor-modifier- = of -intensifier- (perspicacity / fortitude / passion / wit / perception / presence of mind)   \
-comma-description-phrase- = , -a-an- ([1] -person-adjective- / [1] ()) -descriptor- ([1] -descriptor-modifier- / [2] ()) ,   \
-person-description- = -name- ([2] -comma-description-phrase- / [1] ())   \
-two-to-six- = two / three / four / five / six / some   \
-day-weather- = [1] (rainy / foggy / blistering / blustery / gloomy / dank) / [2] ()   \
-time-unit- = week / month / season   \
-day-part- = day / afternoon / morning / evening   \
-day-of-week- = Monday / Tuesday / Wednesday / Thursday / Friday / Saturday   \
-holiday- = Christmas / Boxing Day / St. Swithin's Day   \
-travel-place- = Mozambique / Uganda / the Seychelles / the Vatican / Peoria / Borneo / Antarctica / Somerville / Northumberland / Saxony / Brugges / Gondwanaland   \
-travel-time- = ([2] while / [1] whilst) (on safari to / exploring / on an expedition to / hunting in / on sabbatical in) -travel-place-   \
-time- = longtime{ one -day-weather- -day-part- / one -day-weather- -day-part- last -time-unit- / last -day-of-week- / last -time-unit- / -a-an- -time-unit- ago / on -holiday- / last -holiday- / -a-an- -time-unit- ago -holiday- / -two-to-six- -time-unit- -adjoining- s ago / -travel-time- }   \
-maybe-comma- = [2] () / [1] ,   \
-time-comma- = longtime{ -maybe-comma- / , / -maybe-comma- / -maybe-comma- / -maybe-comma- / -maybe-comma- / -maybe-comma- / , }   \
-passive-action-word- = exploded / vaporized / melted / sublimated / evaporated / transformed / calcified / vanished / faded / disappeared / shrivelled / bloated / liquefied / was lost / was misplaced / was bartered   \
-dest-noun- = solidity{ slime / stew / secretion / mist / smoke / dust / vapor }   \
-dest-modifier- = noisome / pearlescent / foul / fetid / glittering / dark / briny / glistening / cloying   \
-dest-form- = solidity{ puddle / bucket / vat / heap / cloud / waft }   \
-action-result- = -dest-noun- / -dest-modifier- -dest-noun- / -a-an- -dest-noun- / -a-an- -dest-modifier- -dest-noun- / -a-an- -dest-form- of -dest-noun- / -a-an- -dest-form- of -dest-modifier- -dest-noun- / -a-an- -dest-modifier- -dest-form- of -dest-noun-   \
-passive-action-qualifier- = away / at sea / without a trace / unexpectedly / mysteriously / into -action-result- / (away into) -action-result-   \
-passive-action- = -passive-action-word- ([2] -passive-action-qualifier- / [3] ())   \
-active-action-word- = fell / tumbled / disappeared / plummeted / vanished / dropped   \
-active-action-prep-hi- = down from / off / from   \
-active-action-prep-lo- = down / into   \
-active-action-prep- = altitude{ -active-action-prep-hi- / -active-action-prep-lo- }   \
-active-action-target-hi- = tower / cliff / ruin / pillar / treehouse / garret   \
-active-action-target-lo- = well / hole / cave / oubliette / cellar / pit   \
-active-action-target- = altitude{ -active-action-target-hi- / -active-action-target-lo- }   \
-target-air- = disreputable / peculiar / mysterious / banal   \
-target-age- = old / moldering / aged / antiquated   \
-active-action- = -active-action-word- -active-action-prep- -a-an- ([1] -target-air- / [2] ()) ([1] -target-age- / [2] ()) -active-action-target-   \
-action- = -passive-action- / -active-action-   \
-gorey-fate- = [2] -person-description- -action- -time- / [2] -time- -time-comma- -person-description- -action- / [1] (it was) -time- that -person-description- -action-   \
-root- = -gorey-fate-   \
";
rules = mutagenParse(eg);
var factory = Factory(rules['-person-description-']);
var str = factory(0);
console.log(str);
