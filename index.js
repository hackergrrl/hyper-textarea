var hstring = require('hyper-string')
var memdb = require('memdb')
var getTextOpStream = require('textarea-op-stream')

function wrap (ta, db, id) {
  this.opStream = getTextOpStream(ta)

  var string = hstring(db)
  ta.string = string

  string.log.on('add', function (node) {
    var value = node.value
    var remote = false

    // TODO: HACK: for now, this means it was a remote op
    if (Buffer.isBuffer(value)) {
      value = JSON.parse(value.toString())
      remote = true
      // console.log('I think', id, 'is remote')
    }
    console.log(id, 'add', value.chr, remote)

    if (remote) {
      refresh()
    }
  })

  var refreshSemaphor = 0
  function refresh () {
    if (refreshSemaphor) {
      refreshSemaphor++
      return
    }
    refreshSemaphor++

    var start = ta.selectionStart
    var end = ta.selectionEnd
    string.text(function (err, text) {
      if (err) throw err
      console.log(id, 'REFRESH to', text)
      ta.value = text

      var sem = refreshSemaphor
      refreshSemaphor = 0
      if (sem > 1) {
        refresh()
      }
      // ta.selectionStart = start
      // ta.selectionEnd = end
    })
  }

  this.opStream.on('data', function (op) {
    // TODO: prevent race conditions here!

    // console.log(id, 'op-data', op)
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
          // console.log('local inserted "' + elem.chr + '" @ ' + elem.pos + ' (after ' + at + ')')
          at = elem.pos
          toInsert = toInsert.slice(1)
          if (toInsert.length > 0) {
            string.insert(at, toInsert[0], postInsert)
          } else {
            string.text(function (err, text) {
              // console.log(id, 'FULL TEXT:', text)
            })
          }
        }
      })
    } else if (op.op === 'delete') {
      string.chars(function (err, chars) {
        if (err) throw err
        if (!chars[op.pos]) {
          throw new Error('deletion location doesn\'t exist locally')
        }

        // accumulate IDs of inserted chars to delete
        var toDelete = []
        for (var i=op.pos; i < op.pos + op.count; i++) {
          toDelete.push(chars[i].pos)
        }

        // sequential async deletions
        at = toDelete[0]
        string.delete(at, postDelete)

        function postDelete (err, elem) {
          // console.log('deleted @ ' + at)
          at = elem.pos
          toDelete.shift()
          if (toDelete.length > 0) {
            string.delete(at, postDelete)
          } else {
            string.text(function (err, text) {
              // console.log(id, 'FULL TEXT:', text)
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

document.body.innerHTML = ''

var ta = document.createElement('textarea')
ta.setAttribute('cols', 80)
ta.setAttribute('rows', 8)
document.body.appendChild(ta)
wrap(ta, memdb(), '1')

var ta2 = document.createElement('textarea')
ta2.setAttribute('cols', 80)
ta2.setAttribute('rows', 8)
document.body.appendChild(ta2)
wrap(ta2, memdb(), '2')


// replicate between
var r1 = ta.string.createReplicationStream({ live: true })
var r2 = ta2.string.createReplicationStream({ live: true })
r1.pipe(r2).pipe(r1)
