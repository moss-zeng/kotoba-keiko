// /api/kanji/:id —— 表记词的编辑(PUT)与删除(DELETE)

export async function onRequestPut({ request, env, params }) {
  const data = await request.json().catch(() => null)
  if (!data) return jsonError('请求体不是合法 JSON', 400)

  const hyoki = (data.hyoki ?? '').trim()
  const kana = (data.kana ?? '').trim()
  const meaning = (data.meaning ?? '').trim()
  if (!hyoki || !kana || !meaning) {
    return jsonError('表记、假名、释义都不能为空', 400)
  }

  // 只改内容，score 保留
  await env.DB.prepare(
    'UPDATE kanji_words SET hyoki = ?, kana = ?, meaning = ? WHERE id = ?'
  )
    .bind(hyoki, kana, meaning, params.id)
    .run()
  return Response.json({ ok: true })
}

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM kanji_words WHERE id = ?')
    .bind(params.id)
    .run()
  return Response.json({ ok: true })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
