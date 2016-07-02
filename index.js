var hstring = require('hyper-string')
var memdb = require('memdb')
var getTextOpStream = require('textarea-op-stream')

function wrap (ta, db) {
  this.opStream = getTextOpStream(ta)

  var string = hstring(db)

  var self = this
  this.opStream.on('data', function (op) {
    // TODO: prevent race conditions here!

    if (op.op === 'insert') {
      string.chars(function (err, chars) {
        if (err) throw err
        var at = null
        if (op.pos && chars[op.pos - 1]) {
          at = chars[op.pos - 1].pos
        }

        // recursive async insertions
        var toInsert = op.str
        string.insert(at, op.str[0], postInsert)

        function postInsert (err, elem) {
          console.log('inserted "' + elem.chr + '" @ ' + elem.pos + ' (after ' + at + ')')
          at = elem.pos
          toInsert = toInsert.slice(1)
          if (toInsert.length > 0) {
            string.insert(at, toInsert[0], postInsert)
          } else {
            console.log('DONE')
            string.text(function (err, text) {
              console.log('FULL TEXT:', text)
            })
          }
        }
      })
    } else if (op.op === 'delete') {
      // 1. find the ID of the char referred to
      // 2. make successive async deletes
      string.chars(function (err, chars) {
        if (err) throw err
        console.log('op.pos', op.pos)
        console.log('chars', chars)
        if (!chars[op.pos]) {
          throw new Error('deletion location doesn\'t exist locally')
        }

        // accumulate IDs of inserted chars to delete
        var toDelete = []
        console.log('chars', chars)
        for (var i=op.pos; i < op.pos + op.count; i++) {
          toDelete.push(chars[i].pos)
        }

        // sequential async deletions
        at = toDelete[0]
        string.delete(at, postDelete)

        function postDelete (err, elem) {
          console.log('deleted @ ' + at)
          at = elem.pos
          toDelete.shift()
          if (toDelete.length > 0) {
            string.delete(at, postDelete)
          } else {
            console.log('DONE')
            string.text(function (err, text) {
              console.log('FULL TEXT:', text)
            })
          }
        }
      })
    }
  })

  return ta
}

module.exports = wrap


// ---


var ta = document.createElement('textarea')
ta.setAttribute('cols', 80)
ta.setAttribute('rows', 24)

document.body.innerHTML = ''
document.body.appendChild(ta)
wrap(ta, memdb())
