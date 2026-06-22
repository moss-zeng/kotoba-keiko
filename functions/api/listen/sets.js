// /api/listen/sets —— 听力集的查询与新增

export async function onRequestGet({ env }) {
  // 带上每个集的小节数，方便列表展示
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.name, s.audio_key, s.duration, s.created_at,
            (SELECT COUNT(*) FROM listening_segment g WHERE g.set_id = s.id) AS seg_count
     FROM listening_set s
     ORDER BY s.id DESC`
  ).all()
  return Response.json(results)
}

export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data) return jsonError('请求体不是合法 JSON', 400)

  const name = (data.name ?? '').trim()
  if (!name) return jsonError('听力集名字不能为空', 400)

  const { meta } = await env.DB.prepare('INSERT INTO listening_set (name) VALUES (?)')
    .bind(name)
    .run()

  return Response.json({ id: meta.last_row_id, name, audio_key: null, duration: null, seg_count: 0 }, { status: 201 })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
