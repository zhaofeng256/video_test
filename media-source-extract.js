// ==UserScript==
// @name         my-media-source-extract
// @namespace    https://github.com/Momo707577045/media-source-extract
// @version      0.8.2
// @description  https://github.com/Momo707577045/media-source-extract 配套插件
// @author       Momo707577045
// @include      *
// @exclude      http://blog.luckly-mjw.cn/tool-show/media-source-extract/player/player.html
// @downloadURL	 https://blog.luckly-mjw.cn/tool-show/media-source-extract/media-source-extract.user.js
// @updateURL	   https://blog.luckly-mjw.cn/tool-show/media-source-extract/media-source-extract.user.js
// @grant        none
// @run-at document-start
// ==/UserScript==

      const externalScript = `
/*! streamsaver. MIT License. Jimmy W盲rting <https://jimmy.warting.se/opensource> */

/* global chrome location ReadableStream define MessageChannel TransformStream */

; ((name, definition) => {
  typeof module !== 'undefined'
    ? module.exports = definition()
    : typeof define === 'function' && typeof define.amd === 'object'
      ? define(definition)
      : this[name] = definition()
})('streamSaver', () => {
  'use strict'

  const global = typeof window === 'object' ? window : this
  if (!global.HTMLElement) console.warn('streamsaver is meant to run on browsers main thread')

  let mitmTransporter = null
  let supportsTransferable = false
  const test = fn => { try { fn() } catch (e) { } }
  const ponyfill = global.WebStreamsPolyfill || {}
  const isSecureContext = global.isSecureContext
  // TODO: Must come up with a real detection test (#69)
  let useBlobFallback = /constructor/i.test(global.HTMLElement) || !!global.safari || !!global.WebKitPoint
  const downloadStrategy = isSecureContext || 'MozAppearance' in document.documentElement.style
    ? 'iframe'
    : 'navigate'

  const streamSaver = {
    createWriteStream,
    WritableStream: global.WritableStream || ponyfill.WritableStream,
    supported: true,
    version: { full: '2.0.5', major: 2, minor: 0, dot: 5 },
    mitm: 'https://upyun.luckly-mjw.cn/lib/stream-saver-mitm.html'
  }

  /**
   * create a hidden iframe and append it to the DOM (body)
   *
   * @param  {string} src page to load
   * @return {HTMLIFrameElement} page to load
   */
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

  /**
   * create a popup that simulates the basic things
   * of what a iframe can do
   *
   * @param  {string} src page to load
   * @return {object}     iframe like object
   */
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
    // We can't look for service worker since it may still work on http
    new Response(new ReadableStream())
    if (isSecureContext && !('serviceWorker' in navigator)) {
      useBlobFallback = true
    }
  } catch (err) {
    useBlobFallback = true
  }

  test(() => {
    // Transferable stream was first enabled in chrome v73 behind a flag
    const { readable } = new TransformStream()
    const mc = new MessageChannel()
    mc.port1.postMessage(readable, [readable])
    mc.port1.close()
    mc.port2.close()
    supportsTransferable = true
    // Freeze TransformStream object (can only work with native)
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

  /**
   * @param  {string} filename filename that should be used
   * @param  {object} options  [description]
   * @param  {number} size     deprecated
   * @return {WritableStream<Uint8Array>}
   */
  function createWriteStream(filename, options, size) {
    let opts = {
      size: null,
      pathname: null,
      writableStrategy: undefined,
      readableStrategy: undefined
    }

    let bytesWritten = 0 // by StreamSaver.js (not the service worker)
    let downloadUrl = null
    let channel = null
    let ts = null
    let writer = null
    let windowNum = 0

    // normalize arguments
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

      // Make filename RFC5987 compatible
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
          // This transformer & flush method is only used by insecure context.
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
        // Service worker sent us a link that we should open.
        if (evt.data.download) {
          // Special treatment for popup...
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
              // Special case for firefox, they can keep sw alive with fetch
              if (downloadStrategy === 'iframe') {
                makeIframe(streamSaver.mitm)
              }
            }

            // We never remove this iframes b/c it can interrupt saving
            makeIframe(evt.data.download)
          }
        } else if (evt.data.abort) {
          chunks = []
          channel.port1.postMessage('abort') //send back so controller is aborted
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
          // Safari... The new IE6
          // https://github.com/jimmywarting/StreamSaver.js/issues/69
          //
          // even though it has everything it fails to download anything
          // that comes from the service worker..!
          chunks.push(chunk)
          return
        }

        // is called when a new chunk of data is ready to be written
        // to the underlying sink. It can return a promise to signal
        // success or failure of the write operation. The stream
        // implementation guarantees that this method will be called
        // only after previous writes have succeeded, and never after
        // close or abort is called.

        // TODO: Kind of important that service worker respond back when
        // it has been written. Otherwise we can't handle backpressure
        // EDIT: Transferable streams solves this...
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
    writer.getWriter = (function(){
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


  return streamSaver
})
`;

(function () {
  'use strict';
  (function () {
    if (document.getElementById('my-media-source-extract')) {
      return
    }

    // 复写 call 函数，绕过劫持检查
    Function.prototype.toString.call = function (caller) {
      return `'function ${caller.name}() { [native code] }'`
    }

    // 轮询监听 iframe 的加载
    setInterval(() => {
      try {
        Array.prototype.forEach.call(document.getElementsByTagName('iframe'), (iframe) => {
          // 若 iframe 使用了 sandbox 进行操作约束，删除原有 iframe，拷贝其备份，删除 sandbox 属性，重新载入
          // 若 iframe 已载入，再修改 sandbox 属性，将修改无效。故通过新建 iframe 的方式绕过
          if (iframe.hasAttribute('sandbox')) {
            const parentNode = iframe.parentNode;
            const tempIframe = iframe.cloneNode()
            tempIframe.removeAttribute("sandbox");
            iframe.remove()
            parentNode.appendChild(tempIframe);
          }
        })
      } catch (error) {
        console.log(error)
      }
    }, 1000)

    let sumFragment = 0 // 已经捕获的所有片段数
    let isClose = false // 是否关闭
    let isStreamDownload = false // 是否使用流式下载
    let _sourceBufferList = [] // 媒体轨道
    const $showBtn = document.createElement('div') // 展示按钮
    const $btnDownload = document.createElement('div') // 下载按钮
    const $btnStreamDownload = document.createElement('div') // 流式下载按钮
    const $downloadNum = document.createElement('div') // 已捕获视频片段数
    const $tenRate = document.createElement('div') // 十倍速播放
    const $closeBtn = document.createElement('div') // 关闭
    const $container = document.createElement('div') // 容器
    $closeBtn.innerHTML = `
    <img style="
      padding-top: 4px;
      width: 24px;
      display: inline-block;
      cursor: pointer;
    " src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAk1BMVEUAAAD////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////ROyVeAAAAMHRSTlMA1Sq7gPribxkJx6Ey8onMsq+GTe10QF8kqJl5WEcvIBDc0sHAkkk1FgO2ZZ+dj1FHfPqwAAACNElEQVRIx6VW6ZqqMAwtFlEW2Rm3EXEfdZa+/9PdBEvbIVXu9835oW1yjiQlTWQE/iYPuTObOTzMNz4bQFRlY2FgnFXRC/o01mytiafP+BPvQZk56bcLSOXem1jpCy4QgXvRtlEVCARfUP65RM/hp29/+0R7eSbhoHlnffZ8h76e6x1tyw9mxXaJ3nfTVLd89hQr9NfGceJxfLIXmONh6eNNYftNSESRmgkHlEOjmhgBbYcEW08FFQN/ro6dvAczjhgXEdQP76xHEYxM+igQq259gLrCSlwbD3iDtTMy+A4Yuk0B6zV8c+BcO2OgFIp/UvJdG4o/Rp1JQYXeZFflPEFMfvugiFGFXN587YtgX7C8lRGFXPCGGYCCzlkoxJ4xqmi/jrIcdYYh5pwxiwI/gt7lDDFrcLiMKhBJ//W78ENsJgVUsV8wKpjZBXshM6cCW0jbRAilICFxIpgGMmmiWGHSIR6ViY+DPFaqSJCbQ5mbxoZLIlU0Al/cBj6N1uXfFI0okLppi69StmumSFQRP6oIKDedFi3vRDn3j6KozCZlu0DdJb3AupJXNLmqkk9+X9FEHLt1Jq8oi1H5n01AtRlvwQZQl9hmtPY4JEjMDs5ftWJN4Xr4lLrV2OHiUDHCPgvA/Tn/hP4zGUBfjZ3eLJ+NIOfHxi8CMoAQtYfmw93v01O0e7VlqqcCsXML3Vsu94cxnb4c7ML5chG8JIP9b38dENGaj3+x+TpiA/AL/fen8In7H8l3ZjdJQt2TAAAAAElFTkSuQmCC">`
    $showBtn.innerHTML = `
    <img style="
      padding-top: 4px;
      width: 24px;
      display: inline-block;
      cursor: pointer;
    " src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIBAMAAABfdrOtAAAAElBMVEUAAAD///////////////////8+Uq06AAAABXRSTlMA2kCAv5tF5NoAAAErSURBVHja7dzNasJAFIbhz8Tu7R0Eq/vQNHuxzL6YnPu/ldYpAUckxJ8zSnjfdTIPzHrOUawJdqmDJre1S/X7avigbM08kMgMSmt+iPWKbcwTsb3+KswXseOFLb2RnaTgjXTxtpwRq7XMgWz9kZ8cSKcwE6SX+SMGAgICAvJCyHdz2ud0pEx+/BpFaj2kEgQEBAQEBAQEBOT1kXWSkhbvk1vptOLs1LEWNrmVRgIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBeTayTqpufogxduqM3q2AgICAgICAgICA3IOko4ZXkB/pqOHzhyZBQEBAQLIieVahtDNBDnrLgZT+yC4HUkmtN9JnWUiVZbVWliVhseCJdPqvCH5IV2tQNl4r6Bod+wWq9eeDik+xFQAAAABJRU5ErkJggg==">`

    // 十倍速播放
    function _tenRatePlay() {
      let playbackRate = 10
      if ($tenRate.innerHTML === '十倍速捕获') {
        $tenRate.innerHTML = '恢复正常播放'
      } else {
        playbackRate = 1
        $tenRate.innerHTML = '十倍速捕获'
      }

      let $domList = document.getElementsByTagName('video')
      for (let i = 0, length = $domList.length; i < length; i++) {
        const $dom = $domList[i]
        $dom.playbackRate = playbackRate
      }
    }

    // 获取顶部 window title，因可能存在跨域问题，故使用 try catch 进行保护
    function getDocumentTitle() {
      let title = document.title;
      try {
        title = window.top.document.title
      } catch (error) {
        console.log(error)
      }
      return title
    }

    // 流式下载
    function _streamDownload() {
      // var _hmt = _hmt || [];
      // (function () {
        // var hm = document.createElement("script");
        // hm.src = "https://hm.baidu.com/hm.js?1f12b0865d866ae1b93514870d93ce89";
        // var s = document.getElementsByTagName("script")[0];
        // s.parentNode.insertBefore(hm, s);
      // })();

      // 对应状态未下载结束的媒体轨道
      const remainSourceBufferList = []
      _sourceBufferList.forEach((target) => {
        // 对应的 MSE 状态为已下载完成状态
        if (target.MSEInstance.readyState === 'ended') {
          target.streamWriter.close()
        } else {
          remainSourceBufferList.push(target)
        }
      })
      // 流式下载，释放已下载完成的媒体轨道，回收内存
      _sourceBufferList = remainSourceBufferList
    }

    // 普通下载
    function _download() {
      // var _hmt = _hmt || [];
      // (function () {
        // var hm = document.createElement("script");
        // hm.src = "https://hm.baidu.com/hm.js?1f12b0865d866ae1b93514870d93ce89";
        // var s = document.getElementsByTagName("script")[0];
        // s.parentNode.insertBefore(hm, s);
      // })();

      _sourceBufferList.forEach((target) => {
        const mime = target.mime.split(';')[0]
        const type = mime.split('/')[1]
        const fileBlob = new Blob(target.bufferList, { type: mime }) // 创建一个Blob对象，并设置文件的 MIME 类型
        const a = document.createElement('a')
        a.download = `${getDocumentTitle()}.${type}`
        a.href = URL.createObjectURL(fileBlob)
        a.style.display = 'none'
        document.body.appendChild(a)
        // 禁止 click 事件冒泡，避免全局拦截
        a.onclick = function (e) {
          e.stopPropagation();
        }
        a.click()
        a.remove()
      })
    }

    // 监听资源全部录取成功
    let _endOfStream = window.MediaSource.prototype.endOfStream
    window.MediaSource.prototype.endOfStream = function endOfStream() {
      if (isStreamDownload) {
        alert('资源全部捕获成功，即将下载！')
        setTimeout(_streamDownload) // 等待 MediaSource 状态变更
        _endOfStream.call(this)
        return
      }

      if (confirm('资源全部捕获成功，即将下载！') == true) {
        //_download()
      } else {
        // 不下载资源
      }
      _download()
      _endOfStream.call(this)
    }

    // 录取资源
    let _addSourceBuffer = window.MediaSource.prototype.addSourceBuffer
    window.MediaSource.prototype.addSourceBuffer = function addSourceBuffer(mime) {
      _appendDom()
      let sourceBuffer = _addSourceBuffer.call(this, mime)
      let _append = sourceBuffer.appendBuffer
      let bufferList = []
      const _sourceBuffer = {
        mime,
        bufferList,
        MSEInstance: this,
        id:1,//media source
        subId:1,
        fragments:0,
      }
      _sourceBufferList.push(_sourceBuffer)
      _sourceBuffer.mime = mime
      _sourceBuffer.id = _sourceBufferList.length
      // 如果 streamSaver 已提前加载完成，则初始化对应的 streamWriter
      try {
        if (window.streamSaver) {
          const type = mime.split(';')[0].split('/')[1]
          const fileName = `${getDocumentTitle().substr(0,10)}-${_sourceBuffer.id}-${_sourceBuffer.subId}.${type}`
          _sourceBuffer.streamWriter = streamSaver.createWriteStream(fileName).getWriter()
          console.debug('-- create file ', fileName)
        }
      } catch (error) {
        console.error(error)
      }

      sourceBuffer.appendBuffer = function (buffer) {
        sumFragment++
        $downloadNum.innerHTML = `已捕获 ${sumFragment} 个片段`

        if (isStreamDownload && _sourceBuffer.streamWriter) { // 流式下载
              _sourceBuffer.fragments++
              console.debug('buffer fragments', _sourceBuffer.id, _sourceBuffer.fragments, _sourceBuffer.subId)
              const subId = Math.ceil(_sourceBuffer.fragments/50) + 1;

              if (subId != _sourceBuffer.subId) {
                _sourceBuffer.streamWriter.close();
                const type = mime.split(';')[0].split('/')[1];
                const fileName = `${getDocumentTitle().substr(0,10)}-${_sourceBuffer.id}-${subId}.${type}`;
                _sourceBuffer.streamWriter = streamSaver.createWriteStream(fileName).getWriter();
                _sourceBuffer.subId = subId;
                console.debug('++ create file ', fileName)
              }

          _sourceBuffer.streamWriter.write(new Uint8Array(buffer));
        } else { // 普通 blob 下载
          bufferList.push(buffer)
        }
        _append.call(this, buffer)
      }
      return sourceBuffer
    }
    window.MediaSource.prototype.addSourceBuffer.toString = function toString() {
      return 'function addSourceBuffer() { [native code] }'
    }

    // 添加操作的 dom
    function _appendDom() {
      if (document.getElementById('media-source-extract')) {
        return
      }
      $container.style = `
      position: fixed;
      top: 50px;
      right: 50px;
      text-align: right;
      z-index: 9999;
      `
      const baseStyle = `
      float:right;
      clear:both;
      margin-top: 10px;
      padding: 0 20px;
      color: white;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      line-height: 40px;
      text-align: center;
      border-radius: 4px;
      background-color: #3498db;
      box-shadow: 0 3px 6px 0 rgba(0, 0, 0, 0.3);
    `
      $tenRate.innerHTML = '十倍速捕获'
      $downloadNum.innerHTML = '已捕获 0 个片段'
      $btnStreamDownload.innerHTML = '特大视频下载，边下载边保存'
      $btnDownload.innerHTML = '下载已捕获片段'
      $btnDownload.id = 'media-source-extract'
      $tenRate.style = baseStyle
      $downloadNum.style = baseStyle
      $btnDownload.style = baseStyle
      $btnStreamDownload.style = baseStyle
      $btnStreamDownload.style.display = 'none'
      $showBtn.style = `
      float:right;
      clear:both;
      display: none;
      margin-top: 4px;
      height: 34px;
      width: 34px;
      line-height: 34px;
      text-align: center;
      border-radius: 4px;
      background-color: rgba(0, 0, 0, 0.5);
      `
      $closeBtn.style = `
      float:right;
      clear:both;
      margin-top: 10px;
      height: 34px;
      width: 34px;
      line-height: 34px;
      text-align: center;
      display: inline-block;
      border-radius: 50%;
      background-color: rgba(0, 0, 0, 0.5);
      `

      $btnDownload.addEventListener('click', _download)
      $tenRate.addEventListener('click', _tenRatePlay)

      // 关闭控制面板
      $closeBtn.addEventListener('click', function () {
        $downloadNum.style.display = 'none'
        $btnStreamDownload.style.display = 'none'
        $btnDownload.style.display = 'none'
        $closeBtn.style.display = 'none'
        $tenRate.style.display = 'none'
        $showBtn.style.display = 'inline-block'
        isClose = true
      })

      // 显示控制面板
      $showBtn.addEventListener('click', function () {
        if (!isStreamDownload) {
          $btnDownload.style.display = 'inline-block'
          $btnStreamDownload.style.display = 'inline-block'
        }
        $downloadNum.style.display = 'inline-block'
        $closeBtn.style.display = 'inline-block'
        $tenRate.style.display = 'inline-block'
        $showBtn.style.display = 'none'
        isClose = false
      })

      // 启动流式下载
      $btnStreamDownload.addEventListener('click', function () {
        // (function () {
          // var hm = document.createElement("script");
          // hm.src = "https://hm.baidu.com/hm.js?1f12b0865d866ae1b93514870d93ce89";
          // var s = document.getElementsByTagName("script")[0];
          // s.parentNode.insertBefore(hm, s);
        // })();
        isStreamDownload = true
        $btnDownload.style.display = 'none'
        $btnStreamDownload.style.display = 'none'

        _sourceBufferList.forEach(sourceBuffer => {
          if (!sourceBuffer.streamWriter) {
            const type = sourceBuffer.mime.split(';')[0].split('/')[1]
            const fileName = `${getDocumentTitle().substr(0,10)}-${sourceBuffer.id}-${sourceBuffer.subId}.${type}`
            sourceBuffer.streamWriter = streamSaver.createWriteStream(fileName).getWriter(fileName)
            console.debug('click create file', fileName)

            sourceBuffer.bufferList.forEach(buffer => {
              sourceBuffer.streamWriter.write(new Uint8Array(buffer));
            })
            sourceBuffer.bufferList = []
          }
        })
      })

      document.getElementsByTagName('html')[0].insertBefore($container, document.getElementsByTagName('head')[0]);
      $container.appendChild($btnStreamDownload)
      $container.appendChild($downloadNum)
      $container.appendChild($btnDownload)
      $container.appendChild($tenRate)
      $container.appendChild($closeBtn)
      $container.appendChild($showBtn)

      // 加载 stream 流式下载器
      try {
        let $streamSaver = document.createElement('script')
        $streamSaver.src = 'https://upyun.luckly-mjw.cn/lib/stream-saver.js'
        //$streamSaver.textContent = externalScript;
        document.body.appendChild($streamSaver);
        //$btnStreamDownload.style.display = 'inline-block';
        $streamSaver.addEventListener('load', () => {
          $btnStreamDownload.style.display = 'inline-block'
        })
      } catch (error) {
        console.error(error)
      }
    }
  })()
})();