// /api/listen/audio/* —— 从 R2 读取音频，支持 HTTP Range（拖动/区间播放必需）
// path 为 R2 key，如 /api/listen/audio/listening/3/audio.m4a

export async function onRequestGet({ env, params, request }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path || ''
  if (!key) return new Response('缺少音频路径', { status: 400 })

  const range = parseRange(request.headers.get('Range'))
  const object = await env.AUDIO.get(key, range ? { range } : undefined)
  if (!object) return new Response('音频不存在', { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')

  if (range && object.range) {
    const start = object.range.offset ?? 0
    const len = object.range.length ?? object.size - start
    const end = start + len - 1
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`)
    headers.set('Content-Length', String(len))
    return new Response(object.body, { status: 206, headers })
  }

  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}

// 解析 "bytes=start-end" / "bytes=start-" / "bytes=-suffix"
function parseRange(header) {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return null
  const [, s, e] = m
  if (s === '') {
    const suffix = Number(e)
    return suffix > 0 ? { suffix } : null
  }
  const offset = Number(s)
  if (e === '') return { offset }
  return { offset, length: Number(e) - offset + 1 }
}
