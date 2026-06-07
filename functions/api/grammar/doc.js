// /api/grammar/doc —— 语法笔记原文的读取与保存（整篇）
export async function onRequestGet({ env }) {
  const doc = await env.DB.prepare(
    'SELECT text FROM grammar_doc WHERE id = 1'
  ).first()
  return Response.json({ text: doc ? doc.text : '' })
}

export async function onRequestPut({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data || typeof data.text !== 'string') {
    return Response.json({ error: '参数错误' }, { status: 400 })
  }
  await env.DB.prepare(
    "INSERT OR REPLACE INTO grammar_doc (id, text, updated_at) VALUES (1, ?, datetime('now'))"
  )
    .bind(data.text)
    .run()
  return Response.json({ ok: true })
}
