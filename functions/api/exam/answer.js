// POST /api/exam/answer —— 只判对错并返回正确答案，不改分（算分推迟到结算）
import { normalizeKana, parseOno } from './_shared.js'

export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data) return jsonError('请求体不是合法 JSON', 400)

  const { type, id, answer } = data

  if (type === 'kanji') {
    const row = await env.DB.prepare('SELECT kana FROM kanji_words WHERE id = ?')
      .bind(id)
      .first()
    if (!row) return jsonError('题目不存在', 404)
    const ua = normalizeKana(answer)
    const correct = ua !== '' && ua === normalizeKana(row.kana)
    return Response.json({ correct, correctAnswer: row.kana })
  }

  if (type === 'ono') {
    const row = await env.DB.prepare('SELECT body FROM onomatopoeia WHERE id = ?')
      .bind(id)
      .first()
    if (!row) return jsonError('题目不存在', 404)
    const { answers } = parseOno(row.body)
    const ua = Array.isArray(answer) ? answer : []
    // 全部空都对才算整段对（分数挂整段）
    const correct =
      ua.length === answers.length &&
      answers.every((a, i) => (ua[i] ?? '').trim() === a)
    return Response.json({ correct, correctAnswer: answers })
  }

  return jsonError('未知题型', 400)
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
