// POST /api/exam/save —— 暂存本局（题目 + 已答结果），单行 id=1
export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data || !Array.isArray(data.questions)) return jsonError('参数错误', 400)

  await env.DB.prepare(
    "INSERT OR REPLACE INTO active_exam (id, questions, answers, updated_at) VALUES (1, ?, ?, datetime('now'))"
  )
    .bind(JSON.stringify(data.questions), JSON.stringify(data.answered ?? []))
    .run()
  return Response.json({ ok: true })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
