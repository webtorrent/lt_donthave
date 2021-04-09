const { leaves } = require('webtorrent-fixtures')
const Protocol = require('bittorrent-protocol')
const test = require('tape')
const ltDontHave = require('../')

const id1 = Buffer.from('01234567890123456789')
const id2 = Buffer.from('12345678901234567890')

test('wire.use(ltDontHave())', t => {
  const wire = new Protocol()
  wire.pipe(wire)

  wire.use(ltDontHave())

  t.ok(wire.lt_donthave)
  t.ok(wire.lt_donthave.donthave)
  t.end()
})

test('donthave sent over the wire', t => {
  t.plan(3)

  const wire1 = new Protocol()
  wire1.peerPieces.set(30, true)
  const wire2 = new Protocol()
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(ltDontHave())
  wire2.use(ltDontHave())

  wire2.on('handshake', (infoHash, peerId, extensions) => {
    wire2.handshake(leaves.parsedTorrent.infoHash, id2)
  })

  wire2.on('extended', ext => {
    if (ext === 'handshake') {
      t.pass('wire2 got extended handshake')
      wire2.lt_donthave.donthave(30)
    }
  })

  wire1.lt_donthave.on('donthave', (index) => {
    t.equal(index, 30)
    t.notOk(wire1.peerPieces.get(30), 'piece 30 cleared in bitfield')
  })

  wire1.handshake(leaves.parsedTorrent.infoHash, id1)
})

test('donthave ignored for pieces the peer doesn\'t already have', t => {
  t.plan(1)

  const wire1 = new Protocol()
  const wire2 = new Protocol()
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(ltDontHave())
  wire2.use(ltDontHave())

  wire2.on('handshake', (infoHash, peerId, extensions) => {
    wire2.handshake(leaves.parsedTorrent.infoHash, id2)
  })

  wire2.on('extended', ext => {
    if (ext === 'handshake') {
      t.pass('wire2 got extended handshake')
      wire2.lt_donthave.donthave(30)
    }
  })

  wire1.lt_donthave.on('donthave', (index) => {
    t.fail('should have been filtered out')
  })

  wire1.handshake(leaves.parsedTorrent.infoHash, id1)
})

test('donthave works bidirectionally', t => {
  t.plan(6)

  const wire1 = new Protocol()
  wire1.peerPieces.set(30, true)
  const wire2 = new Protocol()
  wire2.peerPieces.set(20, true)
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(ltDontHave())
  wire2.use(ltDontHave())

  wire2.on('handshake', (infoHash, peerId, extensions) => {
    wire2.handshake(leaves.parsedTorrent.infoHash, id2)
  })

  wire1.on('extended', ext => {
    if (ext === 'handshake') {
      t.pass('wire1 got extended handshake')
      wire1.lt_donthave.donthave(20)
    }
  })

  wire2.on('extended', ext => {
    if (ext === 'handshake') {
      t.pass('wire2 got extended handshake')
      wire2.lt_donthave.donthave(30)
    }
  })

  wire1.lt_donthave.on('donthave', (index) => {
    t.equal(index, 30)
    t.notOk(wire1.peerPieces.get(30), 'piece 30 cleared in bitfield')
  })

  wire2.lt_donthave.on('donthave', (index) => {
    t.equal(index, 20)
    t.notOk(wire2.peerPieces.get(20), 'piece 20 cleared in bitfield')
  })

  wire1.handshake(leaves.parsedTorrent.infoHash, id1)
})

test('requests fail when matching donthave arrives', t => {
  t.plan(5)

  const wire1 = new Protocol()
  const wire2 = new Protocol()
  wire1.peerPieces.set(20, true)
  wire1.peerPieces.set(30, true)
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(ltDontHave())
  wire2.use(ltDontHave())

  wire2.on('handshake', (infoHash, peerId, extensions) => {
    wire2.handshake(leaves.parsedTorrent.infoHash, id2)
    wire2.unchoke()
  })

  wire1.on('unchoke', () => {
    wire1.request(20, 0, 16384, (err) => {
      t.error(err, 'piece 20 succeeded as expected')
    })
    wire1.request(30, 0, 16384, (err) => {
      t.ok(err instanceof Error, 'piece 30 failed as expected')
      t.notOk(wire1.peerPieces.get(30), 'piece 30 cleared in bitfield')
    })
  })

  wire2.on('request', (pieceIndex, chunkOffset, chunkLength, onChunk) => {
    if (pieceIndex === 20) {
      t.pass('got request for piece 20')
      onChunk(null, Buffer.alloc(16384))
    } else if (pieceIndex === 30) {
      t.pass('got request for piece 30')
      wire2.lt_donthave.donthave(30)
      // intentionally not calling `onChunk`
    } else {
      t.fail('got request for unexpected piece')
    }
  })

  wire1.handshake(leaves.parsedTorrent.infoHash, id1)
})
