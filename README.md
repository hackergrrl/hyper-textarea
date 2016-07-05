# hyper-textarea

> Back a textarea with a [hyper-string](https://github.com/noffle/hyper-string)
> for conflict-free p2p replication!

## Background

TODO: fill this in

## Usage

Let's create two `textarea` elements on the same page and back each with their
own hyper-string:

```js
$ cat > example.js
var hyperize = require('hyper-textarea')
var memdb = require('memdb')

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
^D
```

Now start up a dev server + browserify/watchify process with
[wzrd](https://github.com/maxogden/wzrd):

```
$ wzrd example.js:bundle.js
server started at http://localhost:9967
```

Take a look! Everything you type in one textarea will be replicated to the
other in realtime.

## Peer-to-peer Browser Usage

Let's let two different browsers edit a textarea collaboratively, using
[webrtc-swarm](http://github.com/mafintosh/webrtc-swarm) to facilitate
browser-to-browser peering:

```js
cat > p2p-example.js
var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')
var hyperize = require('./')
var memdb = require('memdb')

document.body.innerHTML = ''

var ta = document.createElement('textarea')
ta.setAttribute('cols', 80)
ta.setAttribute('rows', 8)
document.body.appendChild(ta)
var string = hyperize(ta, memdb())


var hub = signalhub('hyper-textarea', [
  'https://signalhub.mafintosh.com'
])

var sw = swarm(hub)

sw.on('peer', function (peer, id) {
  console.log('connected to a new peer:', id)
  var r = string.createReplicationStream({ live: true })
  r.pipe(peer).pipe(r)
})

sw.on('disconnect', function (peer, id) {
  console.log('disconnected from a peer:', id)
})
^D
```

Like before, fire up `wzrd`:

```
$ wzrd p2p-example.js:bundle.js
server started at http://localhost:9967
```

Now open two browser tabs pointing at this address. They'll find each other via
signalhub and start live replicating their text content!

## API

```js
var hyperize = require('hyper-textarea')
```

### var hstring = hyperize(textarea, db)

Backs a textarea element with a
[hyper-string](https://github.com/noffle/hyper-string).

`db` is a [LevelUP](https://github.com/Level/levelup) instance, to abstract away
the storage of the hyper-string. You could use
[memdb](https://github.com/juliangruber/memdb) for in-memory, or
[level](https://github.com/Level/level) for on-disk.

The hyper-string instance is returned, so you can create a live replication
stream:

```js
textarea.string.createReplicationStream({ live: true })
```


## Install

With [npm](https://npmjs.org/) installed, run

```
$ npm install hyper-textarea
```

## See Also

- [hyper-string](https://github.com/noffle/hyper-string)
- [textarea-op-stream](https://github.com/noffle/textarea-op-stream)

## License

ISC
