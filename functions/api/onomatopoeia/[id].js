// /api/onomatopoeia/:id —— 拟态词段落的编辑(PUT)与删除(DELETE)

export async function onRequestPut({ request, env, params }) {
  const data = await request.json().catch(() => null)
  if (!data) return jsonError('请求体不是合法 JSON', 400)

  const body = (data.body ?? '').trim()
  if (!body) return jsonError('段落内容不能为空', 400)

  const marks = body.match(/\*\*([^*]+)\*\*/g) || []
  if (marks.length < 2) {
    return jsonError(
      `段落里至少要用 **词** 标出 2 个空，当前只识别到 ${marks.length} 个`,
      400
    )
  }

  // 只改内容，score 保留
  await env.DB.prepare('UPDATE onomatopoeia SET body = ? WHERE id = ?')
    .bind(body, params.id)
    .run()
  return Response.json({ ok: true })
}

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM onomatopoeia WHERE id = ?')
    .bind(params.id)
    .run()
  return Response.json({ ok: true })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
