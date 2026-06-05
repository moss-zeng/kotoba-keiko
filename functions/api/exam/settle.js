// POST /api/exam/settle —— 结算：批量算分 + 写入考试历史(错题本) + 清空暂存
// 入参：{ answered: [{type,id,correct, hyoki,meaning,parts,correctAnswer,yourAnswer}] }
export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data || !Array.isArray(data.answered)) return jsonError('参数错误', 400)
  const answered = data.answered

  // 1) 批量算分
  const stmts = []
  for (const a of answered) {
    const table =
      a.type === 'kanji'
        ? 'kanji_words'
        : a.type === 'ono'
          ? 'onomatopoeia'
          : null
    if (!table) continue
    const delta = a.correct ? 1 : -1
    stmts.push(
      env.DB.prepare(
        `UPDATE ${table} SET score = score + ? WHERE id = ?`
      ).bind(delta, a.id)
    )
  }
  if (stmts.length) await env.DB.batch(stmts)

  // 2) 写考试历史（仅在有已答题时；错题全量存入 wrong_items）
  if (answered.length > 0) {
    const correct = answered.filter((a) => a.correct).length
    const wrong = answered.filter((a) => !a.correct)
    await env.DB.prepare(
      'INSERT INTO exam_history (total, correct, wrong_items) VALUES (?, ?, ?)'
    )
      .bind(answered.length, correct, JSON.stringify(wrong))
      .run()
  }

  // 3) 清空暂存
  await env.DB.prepare('DELETE FROM active_exam WHERE id = 1').run()
  return Response.json({ ok: true })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
