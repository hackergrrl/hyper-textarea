var hstring = require('hyper-string')
var getTextOpStream = require('textarea-op-stream')
var mutexify = require('mutexify')

module.exports = function (ta, db, id) {
  id = id || (''+Math.random()).substring(2, 3)

  var opStream = getTextOpStream(ta)

  var lock = mutexify()

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
    // console.log(id, 'add', value.chr, remote)

    if (remote) {
      refresh()
    }
  })

  function refresh () {
    lock(function(release) {
      var start = ta.selectionStart
      var end = ta.selectionEnd
      string.text(function (err, text) {
        if (err) throw err
        // console.log(id, 'REFRESH to', text)
        ta.value = text
        // ta.selectionStart = start
        // ta.selectionEnd = end
        release()
      })
    })
  }

  opStream.on('data', function (op) {
    // TODO: prevent race conditions here!

    var start = new Date().getTime()
    lock(function (release) {
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
              var end = new Date().getTime()
              // console.log('insert took', (end-start), 'ms')
              release()
              // string.text(function (err, text) {
              //   console.log(id, 'FULL TEXT:', text)
              // })
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
            // console.log('gonna delete', chars[i].pos)
          }

          // sequential async deletions
          at = toDelete.shift()
          string.delete(at, postDelete)

          function postDelete (err, elem) {
            // console.log('deleted @ ' + at)
            at = toDelete.shift()
            if (at !== undefined) {
              string.delete(at, postDelete)
            } else {
              release()
              // string.text(function (err, text) {
              //   console.log(id, 'FULL TEXT:', text)
              // })
            }
          }
        })
      }
    })
  })

  return ta
}
