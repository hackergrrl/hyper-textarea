var getTextOpStream = require('textarea-op-stream')
var debug = console.log //require('debug')('hyper-textarea')

module.exports = function (ta, string, id) {
  id = id || ('' + Math.random()).substring(2, 3)

  var opStream = getTextOpStream(ta)

  var pendingLocalOps = []

  var pendingRefresh = false
  var pendingCursorOffset = 0

  var cache = null

  string.index.ready(refresh)

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

    if (remote && pendingLocalOps.length === 0) {
      debug('refreshing due to remote op', value)

      if (value.op === 'insert' && cache) {
        var offset = computeNeededCursorOffset(ta.selectionStart, node.key, cache.chars)
        pendingCursorOffset += offset
      }

      refresh()
    }
  })

  function refresh (insertedAt) {
    if (pendingLocalOps.length > 0 || pendingRefresh) {
      return
    }
    pendingRefresh = true

    refreshCache(function (err, cache) {
      if (err) throw err

      pendingRefresh = false

      if (pendingLocalOps.length > 0) return

      var chars = cache.chars
      var text = cache.text
      var start = ta.selectionStart
      var end = ta.selectionEnd

      debug(id, 'REFRESH to', text)
      ta.value = text

      // If the textarea is focused, ensure its cursor position is maintained
      var isFocused = document.activeElement === ta
      if (isFocused) {
        ta.dispatchEvent(new Event('focus'))
      }
      ta.selectionStart = start + pendingCursorOffset
      ta.selectionEnd = end + pendingCursorOffset
      pendingCursorOffset = 0
    })
  }

  opStream.on('data', function (op) {
    debug(id, 'got an op:', op)

    pendingLocalOps.push(op)

    if (pendingLocalOps.length === 1) {
      processOpQueue()
    }
  })

  function processOpQueue () {
    if (pendingLocalOps.length === 0) {
      refresh()
      return
    }
    var op = pendingLocalOps[0]

    if (!cache) {
      // TODO: can prob drop this branch
      console.log('refreshing cache before doing local op..')
      refreshCache(performOp)
    } else {
      performOp()
    }

    function performOp () {
      var chars = cache.chars
      if (op.op === 'insert') {
        var at = null
        console.log('insert local op', op.pos, chars)
        if (op.pos && chars[op.pos - 1]) {
          at = chars[op.pos - 1].pos
        } else {
          debug('FYI: inserting op (' + op + ') at pos NULL')
        }

        debug('inserting: ', op)

        string.insert(at, op.str, function (err, ops) {
          if (err) throw err
          pendingLocalOps.shift()

          // update the cache
          cache.text = splice(cache.text, op.pos, 0, op.str)
          var newChars = ops.map(function (op, idx) {
            return {
              chr: op.chr,
              pos: op.pos
            }
          })
          cache.chars.splice.apply(cache.chars, [op.pos, 0].concat(newChars))

          processOpQueue()
        })
      } else if (op.op === 'delete') {
        if (!chars[op.pos]) {
          throw new Error('deletion location doesn\'t exist locally')
        }
        var at = chars[op.pos].pos

        debug('deleting: ', op)

        string.delete(at, op.count, function (err, ops) {
          if (err) throw err
          pendingLocalOps.shift()

          // update the cache
          cache.text = splice(cache.text, op.pos, op.count, '')
          cache.chars.splice(op.pos, op.count)

          processOpQueue()
        })
      } else {
        throw new Error('uknown op type (' + op.op + ')')
      }
    }
  }

  function refreshCache (done) {
    string.chars(function (err, chars) {
      if (err) return done(err)

      cache = {
        chars: chars,
        text: chars.map(function (c) { return c.chr }).join('')
      }

      done(null, cache)
    })
  }

  return string
}

function computeNeededCursorOffset (selectionStart, insertedAt, chars) {
  for (var i = 0; i < chars.length; i++) {
    if (i > selectionStart) return 0
    if (chars[i].pos === insertedAt) return 1
  }
}

function splice (text, start, delCount, toAdd) {
  return text.substring(0, start) + toAdd + text.substring(start + delCount)
}

