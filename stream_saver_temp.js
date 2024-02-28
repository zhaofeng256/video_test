//StreamSaver
const global = typeof window === 'object' ? window : this
if (!global.HTMLElement) console.warn('streamsaver is meant to run on browsers main thread')
let mitmTransporter = null
let supportsTransferable = false
const test = fn => { try { fn() } catch (e) { } }
const ponyfill = global.WebStreamsPolyfill || {}
const isSecureContext = global.isSecureContext
let useBlobFallback = /constructor/i.test(global.HTMLElement) || !!global.safari || !!global.WebKitPoint
const downloadStrategy = isSecureContext || 'MozAppearance' in document.documentElement.style
  ? 'iframe'
  : 'navigate'
const streamSaver = {
  createWriteStream,
  WritableStream: global.WritableStream || ponyfill.WritableStream,
  supported: true,
  version: { full: '2.0.5', major: 2, minor: 0, dot: 5 },
  mitm: 'http://localhost:80/mitm.html'//'https://upyun.luckly-mjw.cn/lib/stream-saver-mitm.html'
}
function makeIframe(src) {
  if (!src) throw new Error('meh')
  const iframe = document.createElement('iframe')
  iframe.hidden = true
  iframe.src = src
  iframe.loaded = false
  iframe.name = 'iframe'
  iframe.isIframe = true
  iframe.postMessage = (...args) => iframe.contentWindow.postMessage(...args)
  iframe.addEventListener('load', () => {
    iframe.loaded = true
  }, { once: true })
  document.body.appendChild(iframe)
  return iframe
}
function makePopup(src) {
  const options = 'width=200,height=100'
  const delegate = document.createDocumentFragment()
  const popup = {
    frame: global.open(src, 'popup', options),
    loaded: false,
    isIframe: false,
    isPopup: true,
    remove() { popup.frame.close() },
    addEventListener(...args) { delegate.addEventListener(...args) },
    dispatchEvent(...args) { delegate.dispatchEvent(...args) },
    removeEventListener(...args) { delegate.removeEventListener(...args) },
    postMessage(...args) { popup.frame.postMessage(...args) }
  }
  const onReady = evt => {
    if (evt.source === popup.frame) {
      popup.loaded = true
      global.removeEventListener('message', onReady)
      popup.dispatchEvent(new Event('load'))
    }
  }
  global.addEventListener('message', onReady)
  return popup
}
try {
  new Response(new ReadableStream())
  if (isSecureContext && !('serviceWorker' in navigator)) {
    useBlobFallback = true
  }
} catch (err) {
  useBlobFallback = true
}
test(() => {
  const { readable } = new TransformStream()
  const mc = new MessageChannel()
  mc.port1.postMessage(readable, [readable])
  mc.port1.close()
  mc.port2.close()
  supportsTransferable = true
  Object.defineProperty(streamSaver, 'TransformStream', {
    configurable: false,
    writable: false,
    value: TransformStream
  })
})
function loadTransporter() {
  if (!mitmTransporter) {
    mitmTransporter = isSecureContext
      ? makeIframe(streamSaver.mitm)
      : makePopup(streamSaver.mitm)
  }
}
function createWriteStream(filename, options, size) {
  let opts = {
    size: null,
    pathname: null,
    writableStrategy: undefined,
    readableStrategy: undefined
  }
  let bytesWritten = 0
  let downloadUrl = null
  let channel = null
  let ts = null
  let writer = null
  let windowNum = 0
  if (Number.isFinite(options)) {
    [size, options] = [options, size]
    console.warn('[StreamSaver] Deprecated pass an object as 2nd argument when creating a write stream')
    opts.size = size
    opts.writableStrategy = options
  } else if (options && options.highWaterMark) {
    console.warn('[StreamSaver] Deprecated pass an object as 2nd argument when creating a write stream')
    opts.size = size
    opts.writableStrategy = options
  } else {
    opts = options || {}
  }
  if (!useBlobFallback) {
    loadTransporter()
    channel = new MessageChannel()
    filename = encodeURIComponent(filename.replace(/\//g, ':'))
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A')
    const response = {
      transferringReadable: supportsTransferable,
      pathname: opts.pathname || Math.random().toString().slice(-6) + '/' + filename,
      headers: {
        'Content-Type': 'application/octet-stream; charset=utf-8',
        'Content-Disposition': "attachment; filename*=UTF-8''" + filename
      }
    }
    if (opts.size) {
      response.headers['Content-Length'] = opts.size
    }
    const args = [response, '*', [channel.port2]]
    if (supportsTransferable) {
      const transformer = downloadStrategy === 'iframe' ? undefined : {
        transform(chunk, controller) {
          if (!(chunk instanceof Uint8Array)) {
            throw new TypeError('Can only write Uint8Arrays')
          }
          bytesWritten += chunk.length
          controller.enqueue(chunk)
          if (downloadUrl) {
            windowNum++
            location.href = downloadUrl
            downloadUrl = null
          }
        },
        flush() {
          if (downloadUrl) {
            windowNum++
            location.href = downloadUrl
          }
        }
      }
      ts = new streamSaver.TransformStream(
        transformer,
        opts.writableStrategy,
        opts.readableStrategy
      )
      const readableStream = ts.readable
      channel.port1.postMessage({ readableStream }, [readableStream])
    }
    channel.port1.onmessage = evt => {
      if (evt.data.download) {
        if (downloadStrategy === 'navigate') {
          mitmTransporter.remove()
          mitmTransporter = null
          if (bytesWritten) {
            windowNum++
            location.href = evt.data.download
          } else {
            downloadUrl = evt.data.download
          }
        } else {
          if (mitmTransporter.isPopup) {
            mitmTransporter.remove()
            mitmTransporter = null
            if (downloadStrategy === 'iframe') {
              makeIframe(streamSaver.mitm)
            }
          }
          makeIframe(evt.data.download)
        }
      } else if (evt.data.abort) {
        chunks = []
        channel.port1.postMessage('abort')
        channel.port1.onmessage = null
        channel.port1.close()
        channel.port2.close()
        channel = null
      }
    }
    if (mitmTransporter.loaded) {
      mitmTransporter.postMessage(...args)
    } else {
      mitmTransporter.addEventListener('load', () => {
        mitmTransporter.postMessage(...args)
      }, { once: true })
    }
  }
  let chunks = []
  writer = (!useBlobFallback && ts && ts.writable) || new streamSaver.WritableStream({
    write(chunk) {
      if (!(chunk instanceof Uint8Array)) {
        throw new TypeError('Can only write Uint8Arrays')
      }
      if (useBlobFallback) {
        chunks.push(chunk)
        return
      }
      channel.port1.postMessage(chunk)
      bytesWritten += chunk.length
      if (downloadUrl) {
        windowNum++
        location.href = downloadUrl
        downloadUrl = null
      }
    },
    close() {
      if (useBlobFallback) {
        const blob = new Blob(chunks, { type: 'application/octet-stream; charset=utf-8' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = filename
        link.click()
      } else {
        channel.port1.postMessage('end')
      }
    },
    abort() {
      chunks = []
      channel.port1.postMessage('abort')
      channel.port1.onmessage = null
      channel.port1.close()
      channel.port2.close()
      channel = null
    }
  }, opts.writableStrategy)
  const originWriter = writer.getWriter()
  writer.getWriter = (function () {
    return originWriter
  }).bind(originWriter)
  console.log('window.addEventListener(')
  window.addEventListener('beforeunload', () => {
    console.log(windowNum)
    if (windowNum === 0) {
      originWriter.close()
    }
    windowNum--
  })
  return writer
}
streamSaver.createWriteStream = createWriteStream
console.log('streamSaver RUN')