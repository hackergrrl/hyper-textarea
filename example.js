var memdb = require('memdb')
var hyperize = require('./')

document.body.innerHTML = ''

var ta = document.createElement('textarea')
ta.setAttribute('cols', 80)
ta.setAttribute('rows', 8)
document.body.appendChild(ta)
hyperize(ta, memdb())

var ta2 = document.createElement('textarea')
ta2.setAttribute('cols', 80)
ta2.setAttribute('rows', 8)
document.body.appendChild(ta2)
hyperize(ta2, memdb())

// replicate between the two!
var r1 = ta.string.createReplicationStream({ live: true })
var r2 = ta2.string.createReplicationStream({ live: true })
r1.pipe(r2).pipe(r1)
