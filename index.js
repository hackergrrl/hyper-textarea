var getTextOpStream = require('textarea-op-stream')
var mutexify = require('mutexify')
var debug = console.log //require('debug')('hyper-textarea')

module.exports = function (ta, string, id) {
  id = id || ('' + Math.random()).substring(2, 3)

  var opStream = getTextOpStream(ta)

  var refreshLock = mutexify()
  var pendingOps = []

  var pendingRefresh = false

  var pendingLocalInserts = {}

  function ready () {
    debug('hyper-string indexer is ready!')
    refresh()
  }
  string.index.ready(ready)

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
    if (pendingOps.length > 0) {
      return
    }
    if (pendingRefresh) {
      return
    }
    pendingRefresh = true
    // refreshLock(function (release) {
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
        pendingRefresh = false
        // release()
      })
    // })
  }

  opStream.on('data', function (op) {
    debug(id, 'got an op:', op)
    if (pendingOps.length > 0) {
      pendingOps.push(op)
      return
    } else {
      pendingOps.push(op)
      processOpQueue()
    }
  })

  function processOpQueue () {
    if (pendingOps.length === 0) {
      return
    }
    var op = pendingOps[0]

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
          pendingOps.shift()
          processOpQueue()
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
          pendingOps.shift()
          processOpQueue()
        })
      })
    }
  }

  return string
}
