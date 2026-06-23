// POST /api/exam/answer —— 判对错并返回正确答案 + 逐空统计（算分推迟到结算）
// 返回 total_blanks/filled_blanks/correct_blanks，供结算按空格数细化扣分
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
    // 表记的「空」= 假名逐字符；填错字符数（filled≠total）由结算判 100% 扣分
    const cArr = [...normalizeKana(row.kana)]
    const yArr = [...normalizeKana(answer)]
    let correct_blanks = 0
    const n = Math.min(cArr.length, yArr.length)
    for (let i = 0; i < n; i++) if (cArr[i] === yArr[i]) correct_blanks++
    const correct = yArr.length > 0 && yArr.length === cArr.length && correct_blanks === cArr.length
    return Response.json({
      correct,
      correctAnswer: row.kana,
      total_blanks: cArr.length,
      filled_blanks: yArr.length,
      correct_blanks,
    })
  }

  if (type === 'ono') {
    const row = await env.DB.prepare('SELECT body FROM onomatopoeia WHERE id = ?')
      .bind(id)
      .first()
    if (!row) return jsonError('题目不存在', 404)
    const { answers } = parseOno(row.body)
    const ua = Array.isArray(answer) ? answer : []
    let correct_blanks = 0
    answers.forEach((a, i) => {
      if ((ua[i] ?? '').trim() === a) correct_blanks++
    })
    const filled_blanks = ua.filter((x) => (x ?? '').trim() !== '').length
    const correct = correct_blanks === answers.length
    return Response.json({
      correct,
      correctAnswer: answers,
      total_blanks: answers.length,
      filled_blanks,
      correct_blanks,
    })
  }

  return jsonError('未知题型', 400)
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
