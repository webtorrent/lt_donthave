# lt_donthave [![npm][npm-image]][npm-url] [![downloads][downloads-image]][downloads-url] [![javascript style guide][standard-image]][standard-url]

[travis-url]: https://travis-ci.org/webtorrent/lt_donthave
[npm-image]: https://img.shields.io/npm/v/lt_donthave.svg
[npm-url]: https://npmjs.org/package/lt_donthave
[downloads-image]: https://img.shields.io/npm/dm/lt_donthave.svg
[downloads-url]: https://npmjs.org/package/lt_donthave
[standard-image]: https://img.shields.io/badge/code_style-standard-brightgreen.svg
[standard-url]: https://standardjs.com

### The BitTorrent lt_donthave extension (BEP 54)

JavaScript implementation of the [The BitTorrent lt_donthave extension (BEP 54)](https://www.bittorrent.org/beps/bep_0054.html). Use with [bittorrent-protocol](https://www.npmjs.com/package/bittorrent-protocol).

The purpose of this extension is to allow peers to indicate that they no longer have a piece. It provides a single `donthave` message that means the opposite of the standard `have` message. In addition, when a client receives `donthave`, it knows that all requests for the matching piece have failed.

Works in the browser with [browserify](http://browserify.org/)! This module is used by [WebTorrent](http://webtorrent.io).

### install

```
npm install lt_donthave
```

### usage

This package should be used with [bittorrent-protocol](https://www.npmjs.com/package/bittorrent-protocol), which supports a plugin-like system for extending the protocol with additional functionality.

Say you're already using `bittorrent-protocol`. Your code might look something like this:

```js
const BitField = require('bitfield')
const Protocol = require('bittorrent-protocol')
const net = require('net')

net.createServer(socket => {
  var wire = new Protocol()
  socket.pipe(wire).pipe(socket)

  // handle handshake
  wire.on('handshake', (infoHash, peerId) => {
    wire.handshake(Buffer.from('my info hash'), Buffer.from('my peer id'))

    // advertise that we have all 10 pieces of the torrent
    const bitfield = new BitField(10)
    for (let i = 0; i <= 10; i++) {
      bitfield.set(i, true)
    }
    wire.bitfield(bitfield)
  })

}).listen(6881)
```

To add support for BEP 54, simply modify your code like this:

```js
const BitField = require('bitfield')
const Protocol = require('bittorrent-protocol')
const net = require('net')
const lt_donthave = require('lt_donthave')

net.createServer(socket => {
  const wire = new Protocol()
  socket.pipe(wire).pipe(socket)

  // initialize the extension
  wire.use(lt_donthave())

  // all `lt_donthave` functionality can now be accessed at wire.lt_donthave

  wire.on('request', (pieceIndex, offset, length, cb) => {
    // whoops, turns out we don't have any pieces after all
    wire.lt_donthave.donthave(pieceIndex)
    cb(new Error('not found'))
  })

  // 'donthave' event will fire when the remote peer indicates it no longer has a piece
  wire.lt_donthave.on('donthave', index => {
    // remote peer no longer has piece `index`
  })

  // handle handshake
  wire.on('handshake', (infoHash, peerId) => {
    wire.handshake(Buffer.from('my info hash'), Buffer.from('my peer id'))

    // advertise that we have all 10 pieces of the torrent
    const bitfield = new BitField(10)
    for (let i = 0; i <= 10; i++) {
      bitfield.set(i, true)
    }
    wire.bitfield(bitfield)
  })

}).listen(6881)
```

### api

#### `lt_donthave([metadata])`

Initialize the extension. If you have the torrent metadata (Buffer), pass it into the
`lt_donthave` constructor so it's made available to the peer.

```js
const metadata = fs.readFileSync(__dirname + '/file.torrent')
wire.use(lt_donthave(metadata))
```

#### `lt_donthave.fetch()`

Ask the peer to send metadata.

#### `lt_donthave.cancel()`

Stop asking the peer to send metadata.

#### `lt_donthave.setMetadata(metadata)`

Set the metadata. If you didn't have the metadata at the time `lt_donthave` was
initialized, but you end up getting it from another peer (or somewhere else), you should
call `setMetadata` so the metadata will be available to the peer.

#### `lt_donthave.on('metadata', function (metadata) {})`

Fired when metadata is available and verified to be correct. Called with a single
parameter of type Buffer.

```js
wire.lt_donthave.on('metadata', metadata => {
  console.log(Buffer.isBuffer(metadata)) // true
})
```

Note: the event will not fire if the peer does not support lt_donthave, if they
don't have metadata yet either, if they repeatedly send invalid data, or if they
simply don't respond.

#### `lt_donthave.on('warning', function (err) {})`

Fired if:
 - the peer does not support lt_donthave
 - the peer doesn't have metadata yet
 - the peer repeatedly sent invalid data

```js
wire.lt_donthave.on('warning', err => {
  console.log(err.message)
})
```

### license

MIT. Copyright (c) [Feross Aboukhadijeh](https://feross.org) and [WebTorrent, LLC](https://webtorrent.io).
