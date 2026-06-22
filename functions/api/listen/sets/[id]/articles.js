// /api/listen/sets/:id/articles —— 文章的查询与按 (set_id, seq) 的 upsert
// 录入分词结果、以及消费端即时修正读音，都走 POST upsert

export async function onRequestGet({ env, params }) {
  const { results } = await env.DB.prepare(
    'SELECT id, seq, text, tokens FROM listening_article WHERE set_id = ? ORDER BY seq'
  )
    .bind(params.id)
    .all()
  return Response.json(results)
}

export async function onRequestPost({ request, env, params }) {
  const id = params.id
  const data = await request.json().catch(() => null)
  if (!data) return jsonError('请求体不是合法 JSON', 400)

  const seq = Number(data.seq)
  if (!Number.isInteger(seq) || seq < 1) return jsonError('seq 不合法', 400)
  const text = typeof data.text === 'string' ? data.text : ''
  const tokens = Array.isArray(data.tokens) ? JSON.stringify(data.tokens) : '[]'

  await env.DB.prepare(
    `INSERT INTO listening_article (set_id, seq, text, tokens, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(set_id, seq)
     DO UPDATE SET text = excluded.text, tokens = excluded.tokens, updated_at = datetime('now')`
  )
    .bind(id, seq, text, tokens)
    .run()

  return Response.json({ ok: true })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
