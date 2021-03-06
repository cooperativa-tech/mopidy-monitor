const Http = require('http')
const Mopidy = require('mopidy')
const SocketIo = require('socket.io')
const IcecastMonitor = require('icecast-monitor')

let data = {
  current: {
    timePosition: 0,
  },
}
const cors = {
  origin: 'https://radiouniverso.live',
}

const httpServer = Http.createServer()
const socketServer = SocketIo(httpServer, { cors })
const mopidy = new Mopidy({
  webSocketUrl: 'ws://127.0.0.1:6680/mopidy/ws/',
})
const icecastMonitor = new IcecastMonitor({
  host: '127.0.0.1',
  port: 8000,
  user: 'lidersupremo',
  password: 'showmewhatyougot',
})

const updateData = (newData) => {
  data = { ...data, ...newData }
  socketServer.emit('data', data)
}

const onSourceInfo = (err, { listeners, listenerPeak }) => {
  if (err) throw err
  updateData({ listeners, listenerPeak })
}

const onServerListeners = (mount, listeners) => {
  if (mount !== '/radiouniverso') return
  updateData({ listeners })
}

const onServerListenersPeak = (mount, listenerPeak) => {
  if (mount !== '/radiouniverso') return
  updateData({ listenerPeak })
}

const onServerFeed = (err, feed) => {
  if (err) throw err
  feed.on('mount.listeners', onServerListeners)
  feed.on('mount.listenerPeak', onServerListenersPeak)
}

const onTrackEnded = ({ tl_track: { track } }) => {
  const timePosition = track.length
  updateData({ ended: track, current: { ...data.current, timePosition } })
}

const incrementTimePosition = () => {
  data.current.timePosition = data.current.timePosition + 1000
}

const updateTimePosition = async () => {
  const timePosition = await mopidy.playback.getTimePosition()

  updateData({ current: { ...data.current, timePosition } })
}

const onTrackStarted = async ({ tl_track: { track } }) => {
  const images = await mopidy.library.getImages([[track.album.uri]])
  const [image] = images[track.album.uri]
  setTimeout(updateTimePosition, 1000)
  updateData({ current: { ...track, timePosition: 0, image } })
}

const onSocketConnection = async (socket) => {
  icecastMonitor.getSource('/radiouniverso', onSourceInfo)
  if (!mopidy || !mopidy.playback) return
  const timePosition = await mopidy.playback.getTimePosition()
  const newData = { current: { ...data.current, timePosition } }

  updateData(newData)
}

const onSocketDisconnect = () => {
  icecastMonitor.getSource('/radiouniverso', onSourceInfo)
}

const onReady = async () => {
  track = await mopidy.playback.getCurrentTrack()
  const timePosition = await mopidy.playback.getTimePosition()
  const images = await mopidy.library.getImages([[track.album.uri]])
  const [image] = images[track.album.uri]

  updateData({ current: { ...track, timePosition, image } })
  icecastMonitor.getSource('/radiouniverso', onSourceInfo)
}

setInterval(incrementTimePosition, 1000)

mopidy.on('state:online', onReady)
mopidy.on('event:trackPlaybackEnded', onTrackEnded)
mopidy.on('event:trackPlaybackStarted', onTrackStarted)

icecastMonitor.createFeed(onServerFeed)

socketServer.on('connection', onSocketConnection)
socketServer.on('disconnect', onSocketDisconnect)
httpServer.listen(3000)
