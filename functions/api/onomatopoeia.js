// /api/onomatopoeia —— 拟态词段落的查询与新增

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, body, score, stage FROM onomatopoeia ORDER BY id DESC'
  ).all()
  return Response.json(results)
}

export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data) return jsonError('请求体不是合法 JSON', 400)

  const body = (data.body ?? '').trim()
  if (!body) return jsonError('段落内容不能为空', 400)

  // 校验：至少要有 2 个 **标记** 才能当配对题
  const marks = body.match(/\*\*([^*]+)\*\*/g) || []
  if (marks.length < 2) {
    return jsonError(
      `段落里至少要用 **词** 标出 2 个空，当前只识别到 ${marks.length} 个`,
      400
    )
  }

  const { meta } = await env.DB.prepare(
    'INSERT INTO onomatopoeia (body) VALUES (?)'
  )
    .bind(body)
    .run()

  return Response.json(
    { id: meta.last_row_id, body, score: 0, stage: 'learning', blanks: marks.length },
    { status: 201 }
  )
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
