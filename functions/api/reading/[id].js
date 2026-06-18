// /api/reading/:id —— 认读词的编辑(PUT)与删除(DELETE)

export async function onRequestPut({ request, env, params }) {
  const data = await request.json().catch(() => null)
  if (!data) return jsonError('请求体不是合法 JSON', 400)

  const kana = (data.kana ?? '').trim()
  const kanji = (data.kanji ?? '').trim()
  const meanings = Array.isArray(data.meanings) ? data.meanings : []
  if (!kana) return jsonError('假名不能为空', 400)
  if (!meanings.some((m) => (m.cn ?? '').trim())) {
    return jsonError('至少要有一条中文意思', 400)
  }

  // 只改内容，score / graduated_at 保留
  await env.DB.prepare(
    'UPDATE reading_words SET kana = ?, kanji = ?, meanings = ? WHERE id = ?'
  )
    .bind(kana, kanji, JSON.stringify(meanings), params.id)
    .run()
  return Response.json({ ok: true })
}

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM reading_words WHERE id = ?')
    .bind(params.id)
    .run()
  return Response.json({ ok: true })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
