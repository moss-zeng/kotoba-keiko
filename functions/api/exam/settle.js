// POST /api/exam/settle —— 结算：批量算分(含 3→4 升级) + 写历史 + 清暂存
// 入参：{ answered: [{type,id,review,correct, ...}] }
export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data || !Array.isArray(data.answered)) return jsonError('参数错误', 400)
  const answered = data.answered

  const stmts = []
  for (const a of answered) {
    // 认读词：认识 +0.5 / 不认识 −1.5；升入 [3,4) 记时间(15 天后复习)，掉回 <3 清时间
    if (a.type === 'reading') {
      const c = a.correct ? 1 : 0
      stmts.push(
        env.DB.prepare(
          `UPDATE reading_words SET score = score + (CASE WHEN ? THEN 0.5 ELSE -1.5 END), graduated_at = CASE WHEN ? AND (score + 0.5) >= 3 AND (score + 0.5) < 4 THEN datetime('now') WHEN ? = 0 AND (score - 1.5) < 3 THEN NULL ELSE graduated_at END WHERE id = ?`
        ).bind(c, c, c, a.id)
      )
      continue
    }
    const table =
      a.type === 'kanji'
        ? 'kanji_words'
        : a.type === 'ono'
          ? 'onomatopoeia'
          : null
    if (!table) continue

    if (a.review) {
      if (a.correct) {
        // 复习答对 → 4 分，永久不再出现
        stmts.push(env.DB.prepare(`UPDATE ${table} SET score = 4 WHERE id = ?`).bind(a.id))
      } else {
        // 复习答错 → 退回 2 分、清毕业时间，变回普通词重新爬
        stmts.push(
          env.DB.prepare(
            `UPDATE ${table} SET score = 2, graduated_at = NULL WHERE id = ?`
          ).bind(a.id)
        )
      }
    } else if (a.correct) {
      // 常规答对 +1；若刚升到 3 分，记下毕业时间(用于 15 天后复习)
      stmts.push(
        env.DB.prepare(
          `UPDATE ${table} SET score = score + 1, graduated_at = CASE WHEN score + 1 >= 3 THEN datetime('now') ELSE graduated_at END WHERE id = ?`
        ).bind(a.id)
      )
    } else {
      // 常规答错 −1
      stmts.push(env.DB.prepare(`UPDATE ${table} SET score = score - 1 WHERE id = ?`).bind(a.id))
    }
  }
  if (stmts.length) await env.DB.batch(stmts)

  // 写考试历史（错题全量存入 wrong_items）
  if (answered.length > 0) {
    const correct = answered.filter((a) => a.correct).length
    const wrong = answered.filter((a) => !a.correct)
    await env.DB.prepare(
      'INSERT INTO exam_history (total, correct, wrong_items) VALUES (?, ?, ?)'
    )
      .bind(answered.length, correct, JSON.stringify(wrong))
      .run()
  }

  await env.DB.prepare('DELETE FROM active_exam WHERE id = 1').run()
  return Response.json({ ok: true })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
