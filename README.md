# hyper-textarea

> Back a textarea with a [hyper-string](https://github.com/noffle/hyper-string)
> for conflict-free p2p replication!

## Background

TODO: fill this in

## Usage

Let's create two `textarea` elements and back them with a hyper-string:

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

Now we'll start up a dev server + browserify/watchify process with
[wzrd](https://github.com/maxogden/wzrd):

```
$ wzrd index.js:bundle.js
server started at http://localhost:9967
```

And take a look! Everything you type in one textarea will be replicated to the
other.

TODO: maybe an example over the network

## API

```js
var hyperize = require('hyper-textarea')
```

# hyperize(textarea)

Backs a textarea element with a
[hyper-string](https://github.com/noffle/hyper-string). Adds the property
`string` to the textarea, so you can create a replication stream via

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
