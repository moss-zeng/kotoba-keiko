// /api/reading —— 认读词的查询与新增
// meanings: [{ cn 中文意思, sentence 日语造句, note 中文解释 }]

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, kana, kanji, meanings, score FROM reading_words ORDER BY id DESC'
  ).all()
  return Response.json(results)
}

export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data) return jsonError('请求体不是合法 JSON', 400)

  const kana = (data.kana ?? '').trim()
  const kanji = (data.kanji ?? '').trim()
  const meanings = Array.isArray(data.meanings) ? data.meanings : []
  if (!kana) return jsonError('假名不能为空', 400)
  if (!meanings.some((m) => (m.cn ?? '').trim())) {
    return jsonError('至少要有一条中文意思', 400)
  }

  const { meta } = await env.DB.prepare(
    'INSERT INTO reading_words (kana, kanji, meanings) VALUES (?, ?, ?)'
  )
    .bind(kana, kanji, JSON.stringify(meanings))
    .run()

  return Response.json({ id: meta.last_row_id, kana, kanji, score: 0 }, { status: 201 })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
