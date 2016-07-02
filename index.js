var getTextOpStream = require('textarea-op-stream')

function wrap (ta) {
  this.opStream = getTextOpStream(ta)

  this.opStream.on('data', function (op) {
    console.log(op)
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
wrap(ta)
