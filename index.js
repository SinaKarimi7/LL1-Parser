const Table = require('cli-table');

var EPSILON = "ε";

var firstSets = {};
var followSets = {};
var terminals = [];
var nonTerminals = [];

function buildFirstSets(grammar) {
    firstSets = {};
    buildSet(firstOf);
}

function firstOf(symbol) {

    if (firstSets[symbol]) {
        return firstSets[symbol];
    }

    var first = firstSets[symbol] = {};

    // If it's a terminal, its first set is just itself.
    if (isTerminal(symbol)) {
        first[symbol] = true;
        return firstSets[symbol];
    }

    var productionsForSymbol = getProductionsForSymbol(symbol);
    for (var k in productionsForSymbol) {
        var production = getRHS(productionsForSymbol[k]);

        for (var i = 0; i < production.length; i++) {
            var productionSymbol = production[i];

            // Epsilon goes to the first set.
            if (productionSymbol === EPSILON) {
                first[EPSILON] = true;
                break;
            }

            var firstOfNonTerminal = firstOf(productionSymbol);

            if (!firstOfNonTerminal[EPSILON]) {
                merge(first, firstOfNonTerminal);
                break;
            }

            // Else (we got epsilon in the first non-terminal),
            //
            //   - merge all except for epsilon
            //   - eliminate this non-terminal and advance to the next symbol
            //     (i.e. don't break this loop)
            merge(first, firstOfNonTerminal, [EPSILON]);
            // don't break, go to the next `productionSymbol`.
        }
    }

    return first;
}

function getProductionsForSymbol(symbol) {
    var productionsForSymbol = {};
    for (var k in grammar) {
        if (grammar[k][0] === symbol) {
            productionsForSymbol[k] = grammar[k];
        }
    }
    return productionsForSymbol;
}

function getLHS(production) {
    return production.split('->')[0].replace(/\s+/g, '');
}

function getRHS(production) {
    return production.split('->')[1].replace(/\s+/g, '');
}

function buildFollowSets(grammar) {
    followSets = {};
    buildSet(followOf);
}

function followOf(symbol) {

    // If was already calculated from some previous run.
    if (followSets[symbol]) {
        return followSets[symbol];
    }

    // Else init and calculate.
    var follow = followSets[symbol] = {};

    // Start symbol always contain `$` in its follow set.
    if (symbol === START_SYMBOL) {
        follow['$'] = true;
    }

    // We need to analyze all productions where our
    // symbol is used (i.e. where it appears on RHS).
    var productionsWithSymbol = getProductionsWithSymbol(symbol);
    for (var k in productionsWithSymbol) {
        var production = productionsWithSymbol[k];
        var RHS = getRHS(production);

        // Get the follow symbol of our symbol.
        var symbolIndex = RHS.indexOf(symbol);
        var followIndex = symbolIndex + 1;

        // We need to get the following symbol, which can be `$` or
        // may contain epsilon in its first set. If it contains epsilon, then
        // we should take the next following symbol: `A -> aBCD`: if `C` (the
        // follow of `B`) can be epsilon, we should consider first of `D` as well
        // as the follow of `B`.

        while (true) {

            if (followIndex === RHS.length) { // "$"
                var LHS = getLHS(production);
                if (LHS !== symbol) { // To avoid cases like: B -> aB
                    merge(follow, followOf(LHS));
                }
                break;
            }

            var followSymbol = RHS[followIndex];

            // Follow of our symbol is anything in the first of the following symbol:
            // followOf(symbol) is firstOf(followSymbol), except for epsilon.
            var firstOfFollow = firstOf(followSymbol);

            // If there is no epsilon, just merge.
            if (!firstOfFollow[EPSILON]) {
                merge(follow, firstOfFollow);
                break;
            }

            merge(follow, firstOfFollow, [EPSILON]);
            followIndex++;
        }
    }

    return follow;
}

function buildSet(builder) {
    for (var k in grammar) {
        builder(grammar[k][0]);
    }
}

function getProductionsWithSymbol(symbol) {
    var productionsWithSymbol = {};
    for (var k in grammar) {
        var production = grammar[k];
        var RHS = getRHS(production);
        if (RHS.indexOf(symbol) !== -1) {
            productionsWithSymbol[k] = production;
        }
    }
    return productionsWithSymbol;
}

function isTerminal(symbol) {
    return !/[A-Z]/.test(symbol);
}

function merge(to, from, exclude) {
    exclude || (exclude = []);
    for (var k in from) {
        if (exclude.indexOf(k) === -1) {
            to[k] = from[k];
        }
    }
}

function printGrammar(grammar) {
    console.log('Grammar:\n');
    for (var k in grammar) {
        console.log('  ', grammar[k]);
    }
    console.log('');
}

function printSet(name, set) {
    console.log(name + ': \n');
    for (var k in set) {
        console.log('  ', k, ':', Object.keys(set[k]));
    }
    console.log('');
}

// Testing

var grammar = {
    1: 'E -> TX',
    2: 'X -> +TX',
    3: 'X -> ε',
    4: 'T -> FY',
    5: 'Y -> *FY',
    6: 'Y -> ε',
    7: 'F -> (E)',
    8: 'F -> a',
};
var START_SYMBOL = 'E';
var text = "a+a*a+a";

startUp(grammar, text);

var parserTable;


function startUp(grammar, text) {
  printGrammar(grammar);
  buildFirstSets(grammar);
  buildFollowSets(grammar);
  printSet('First sets', firstSets);
  printSet('Follow sets', followSets);
  buildNonTerminals(grammar);
  buildTerminals(grammar);
  parserTable = buildParserTable(grammar);
  drawParsingTable(grammar);
  solve(text);
}

function drawParsingTable(grammar) {
  let ptable = parserTable;
  let table = new Table({
    head: ['', ...terminals, '$']
  });
  nonTerminals.map((nonTerminalItem) => {
    let arr = [];
    terminals.map((terminalItem) => {
      arr.push(ptable[nonTerminalItem][terminalItem] || '');
    });
    arr.push(ptable[nonTerminalItem]['$'] || '');

    // console.log(ptable[item]);
    table.push([nonTerminalItem, ...arr]);
  });
  console.log(table.toString());
}

function buildNonTerminals(grammar) {
  for(var k in grammar) {
    let temp = getLHS(grammar[k]);
    if(nonTerminals.indexOf(temp) == -1) {
        nonTerminals.push(temp);
    }
  }
  console.log("NonTerminals: "+ nonTerminals);
}

function buildTerminals(grammar) {
  for (var k in grammar) {
    let temp = getRHS(grammar[k]);
    for (var i = 0; i < temp.length; i++) {
      if(nonTerminals.indexOf(temp[i]) == -1 && terminals.indexOf(temp[i]) == -1 ) {
        terminals.push(temp[i]);
      }
    }
  }
  console.log("Terminals: "+terminals);
}

function buildParserTable(grammar) {
  let ptable = {};


  // i in nonTerminals
  // j in terminals
  for (var k in grammar) {
    var itRHS = getRHS(grammar[k]);
    var itLHS = getLHS(grammar[k]);
    if(itRHS != EPSILON) {
      let tempTerminals = firstSets[itRHS[0]];
      for (termTemp in tempTerminals) {
          ptable[itLHS] = ptable[itLHS] || {};
          ptable[itLHS][termTemp]=k;
      }
    }
    else {
      let tempTerminals = followSets[itLHS];
      for (termTemp in tempTerminals) {
          ptable[itLHS] = ptable[itLHS] || {};
          ptable[itLHS][termTemp]=k;
      }
    }
  }
  return ptable;
}

function solve(input) {
    let log = [], reg=0;
    let consumedInput = "", remainInput = input+"$";
    let stack = ['$']; let action="nothing!";
    stack.push(START_SYMBOL);
    do {
      let top = stack[stack.length-1];
      if (stack.length == 1 && remainInput=="$")
        action = "Accept!";

      else if(isTerminal(top) && action!= EPSILON){
        action = "Matched!";
        stack.pop();
        consumedInput+=remainInput.slice(0,1);
        remainInput = remainInput.slice(1);
      }
      else if(top == EPSILON)
        stack.pop();
      else {
        let num = parserTable[top][remainInput[0]];
        if(!num) {
            stack.pop();
            reg = 1;
        }
        else{
          action = getRHS(grammar[num]);
          // console.log("stack111: ",stack);
          if(top != remainInput[0]) {
            stack.pop();
            action.split('').reverse().map((t)=>{stack.push(t)});
          }
        }
      }
      let tmp = {
        consumed: consumedInput,
        stack: stack.join(),
        top: stack[stack.length-1],
        remain: remainInput,
        action :action
      };
      log.push(tmp);
      if(action == "Accept!") break;
    } while (stack.length > 0);
    // console.log(parserTable[top][remainInput[0]]);
    let newTable = new Table({
        head: [ 'CONSUMEDINPUT', 'STACK', 'REMAIN', 'ACTION']
    });

    for(item in log) {
      arr = [] ;
      // console.log(log[item]);
      arr.push(log[item].consumed)
      arr.push(log[item].stack)
      arr.push(log[item].remain)
      arr.push(log[item].action)
      newTable.push(arr);
    }
    console.log(newTable.toString());
    // console.log(log);
    // console.log("stack: ",stack);
    console.log((reg)?"Ans: Reject! (but accept with err handler!)":"Ans: Accept!");
}
