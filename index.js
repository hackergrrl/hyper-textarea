var hstring = require('hyper-string')
var getTextOpStream = require('textarea-op-stream')
var mutexify = require('mutexify')
var debug = require('debug')('hyper-textarea')

module.exports = function (ta, db, id) {
  id = id || ('' + Math.random()).substring(2, 3)

  var opStream = getTextOpStream(ta)

  var lock = mutexify()

  var string = hstring(db)

  string.index.ready(function () {
    debug('hyper-string indexer is ready!')
    refresh()
  })

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

    debug('hyper-string gave us a ' + (remote ? 'remote' : 'local') + ' "add":', node)

    if (remote) {
      debug('refreshing due to remote op', value)
      refresh(value.op === 'insert' ? node.key : undefined)
    }
  })

  function refresh (insertedAt) {
    lock(function (release) {
      var isFocused = document.activeElement === ta
      var offset = 0

      string.chars(function (err, chars) {
        if (err) throw err
        var text = chars.map(function (c) { return c.chr }).join('')

        for (var i = 0; i < chars.length; i++) {
          if (i > ta.selectionStart) break
          if (chars[i].pos === insertedAt) { offset++; break }
        }

        debug(id, 'REFRESH to', text)
        var start = ta.selectionStart
        var end = ta.selectionEnd
        ta.value = text

        // If the textarea is focused, ensure its cursor position is maintained
        if (isFocused) {
          ta.dispatchEvent(new Event('focus'))
          ta.selectionStart = start + offset
          ta.selectionEnd = end + offset
        }
        release()
      })
    })
  }

  opStream.on('data', function (op) {
    // TODO: prevent race conditions here!

    var start = new Date().getTime()
    lock(function (release) {
      debug(id, 'got an op:', op)
      if (op.op === 'insert') {
        string.chars(function (err, chars) {
          if (err) throw err
          var at = null
          if (op.pos && chars[op.pos - 1]) {
            at = chars[op.pos - 1].pos
          } else {
            debug('FYI: inserting op (' + op + ') at pos NULL')
          }

          debug('inserting: ', op)
          string.insert(at, op.str, function (err, ops) {
            if (err) throw err
            release()
          })
        })
      } else if (op.op === 'delete') {
        string.chars(function (err, chars) {
          if (err) throw err
          if (!chars[op.pos]) {
            throw new Error('deletion location doesn\'t exist locally')
          }

          var at = chars[op.pos].pos

          debug('deleting: ', op)
          string.delete(at, op.count, function (err, ops) {
            if (err) throw err
            release()
          })
        })
      }
    })
  })

  return string
}
