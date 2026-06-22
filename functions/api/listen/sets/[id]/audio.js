// /api/listen/sets/:id/audio —— 上传该集的主音频到 R2
// 前端把文件作为请求体直传，时长/扩展名通过 query 传：?duration=123.4&ext=m4a

export async function onRequestPost({ request, env, params }) {
  const id = params.id
  const set = await env.DB.prepare('SELECT id, audio_key FROM listening_set WHERE id = ?')
    .bind(id)
    .first()
  if (!set) return jsonError('听力集不存在', 404)

  const url = new URL(request.url)
  const duration = Number(url.searchParams.get('duration')) || null
  const ext = (url.searchParams.get('ext') || 'mp3').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp3'
  const contentType = request.headers.get('Content-Type') || 'application/octet-stream'

  if (!request.body) return jsonError('没有收到音频内容', 400)

  // 同一集换音频时覆盖旧 key（扩展名可能变，先删旧的）
  if (set.audio_key) await env.AUDIO.delete(set.audio_key)
  const key = `listening/${id}/audio.${ext}`
  await env.AUDIO.put(key, request.body, { httpMetadata: { contentType } })

  await env.DB.prepare('UPDATE listening_set SET audio_key = ?, duration = ? WHERE id = ?')
    .bind(key, duration, id)
    .run()

  return Response.json({ ok: true, audio_key: key, duration })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
