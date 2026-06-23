// /api/kanji —— 表记词的查询与新增

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, hyoki, kana, meaning, score, stage FROM kanji_words ORDER BY id DESC'
  ).all()
  return Response.json(results)
}

export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data) return jsonError('请求体不是合法 JSON', 400)

  const hyoki = (data.hyoki ?? '').trim()
  const kana = (data.kana ?? '').trim()
  const meaning = (data.meaning ?? '').trim()
  if (!hyoki || !kana || !meaning) {
    return jsonError('表记、假名、意思都不能为空', 400)
  }

  const { meta } = await env.DB.prepare(
    'INSERT INTO kanji_words (hyoki, kana, meaning) VALUES (?, ?, ?)'
  )
    .bind(hyoki, kana, meaning)
    .run()

  return Response.json(
    { id: meta.last_row_id, hyoki, kana, meaning, score: 0, stage: 'learning' },
    { status: 201 }
  )
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
