// /api/listen/sets/:id —— 单个听力集（含小节+文章）/ 改名 / 删除

export async function onRequestGet({ env, params }) {
  const id = params.id
  const set = await env.DB.prepare(
    'SELECT id, name, audio_key, duration, created_at FROM listening_set WHERE id = ?'
  )
    .bind(id)
    .first()
  if (!set) return jsonError('听力集不存在', 404)

  const [{ results: segments }, { results: articles }] = await Promise.all([
    env.DB.prepare(
      'SELECT id, seq, name, start_sec, end_sec FROM listening_segment WHERE set_id = ? ORDER BY seq'
    )
      .bind(id)
      .all(),
    env.DB.prepare(
      'SELECT id, seq, text, tokens FROM listening_article WHERE set_id = ? ORDER BY seq'
    )
      .bind(id)
      .all(),
  ])

  return Response.json({ ...set, segments, articles })
}

export async function onRequestPut({ request, env, params }) {
  const data = await request.json().catch(() => null)
  if (!data) return jsonError('请求体不是合法 JSON', 400)
  const name = (data.name ?? '').trim()
  if (!name) return jsonError('名字不能为空', 400)

  await env.DB.prepare('UPDATE listening_set SET name = ? WHERE id = ?').bind(name, params.id).run()
  return Response.json({ ok: true })
}

export async function onRequestDelete({ env, params }) {
  const id = params.id
  // 先删 R2 音频，再清理 D1 中关联的小节、文章、集本身
  const set = await env.DB.prepare('SELECT audio_key FROM listening_set WHERE id = ?')
    .bind(id)
    .first()
  if (set?.audio_key) await env.AUDIO.delete(set.audio_key)

  await env.DB.batch([
    env.DB.prepare('DELETE FROM listening_segment WHERE set_id = ?').bind(id),
    env.DB.prepare('DELETE FROM listening_article WHERE set_id = ?').bind(id),
    env.DB.prepare('DELETE FROM listening_set WHERE id = ?').bind(id),
  ])
  return Response.json({ ok: true })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
