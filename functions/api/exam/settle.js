// POST /api/exam/settle —— 结算：写作答事实 + 重算分数/连击/闯关 + 写错题本 + 清暂存
// 入参：{ answered: [{type,id,review,correct, total_blanks,filled_blanks,correct_blanks}] }
//
// 计分模型：
//   基数 1.0（满额扣分），全对 +0.5（加<扣，防乱答）
//   新手期系数(看本次是该词第几次)：第1-3次×0.25 / 4-5次×0.75 / 6+×1.0
//   表记扣分%：填错空格数→100%；总空≥4 错1/2/≥3=20/50/80%；总空3/2/1 非全对=50/70/90%
//   拟态扣分%：总空≤8 错1/2/≥3=20/50/80%；总空>8 错1/2/3/≥4=10/25/40/80%
//   认读：连击模型，认识+1 / 不认识清0，连击达 7 进复习
//   达标→复习关1(等2天)→关2(等3天)→毕业；关1错降回学习(表记/拟态 −1分；认读连击=5)，关2错退回关1
const TABLE = { kanji: 'kanji_words', reading: 'reading_words', ono: 'onomatopoeia' }

// 新手期系数：countBefore=本次作答前的累计次数
function protectFactor(countBefore) {
  const n = countBefore + 1
  return n <= 3 ? 0.25 : n <= 5 ? 0.75 : 1
}

function kanjiPenalty(total, correct, filled) {
  if (filled !== total) return 1 // 填错空格数 → 扣全部
  const wrong = total - correct
  if (wrong <= 0) return 0
  if (total >= 4) return wrong === 1 ? 0.2 : wrong === 2 ? 0.5 : 0.8
  return total === 3 ? 0.5 : total === 2 ? 0.7 : 0.9
}

function onoPenalty(total, correct) {
  const wrong = total - correct
  if (wrong <= 0) return 0
  if (total <= 8) return wrong === 1 ? 0.2 : wrong === 2 ? 0.5 : 0.8
  return wrong === 1 ? 0.1 : wrong === 2 ? 0.25 : wrong === 3 ? 0.4 : 0.8
}

const round2 = (x) => Math.round(x * 100) / 100

// 构造词表派生缓存的 UPDATE（review_due_at 是 SQL 表达式或 NULL，非绑定参数）
function buildUpdate(env, table, valCol, val, count, stage, dueExpr, id) {
  return env.DB.prepare(
    `UPDATE ${table} SET ${valCol} = ?, attempt_count = ?, stage = ?, review_due_at = ${dueExpr || 'NULL'} WHERE id = ?`
  ).bind(val, count, stage, id)
}

export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data || !Array.isArray(data.answered)) return jsonError('参数错误', 400)
  const answered = data.answered

  // 先取各题型当前状态（score/streak、attempt_count、stage）
  const idsByType = { kanji: [], reading: [], ono: [] }
  for (const a of answered) if (idsByType[a.type]) idsByType[a.type].push(a.id)
  const stateByType = { kanji: new Map(), reading: new Map(), ono: new Map() }
  for (const t of ['kanji', 'reading', 'ono']) {
    const ids = [...new Set(idsByType[t])]
    if (!ids.length) continue
    const ph = ids.map(() => '?').join(',')
    const valCol = t === 'reading' ? 'streak' : 'score'
    const { results } = await env.DB.prepare(
      `SELECT id, ${valCol} AS val, attempt_count, stage FROM ${TABLE[t]} WHERE id IN (${ph})`
    )
      .bind(...ids)
      .all()
    for (const r of results) stateByType[t].set(r.id, r)
  }

  const stmts = []
  for (const a of answered) {
    const total = a.total_blanks ?? 1
    const filled = a.filled_blanks ?? 1
    const corr = a.correct_blanks ?? (a.correct ? total : 0)

    // 事实层：每答一次追加一行
    stmts.push(
      env.DB.prepare(
        'INSERT INTO word_attempt (word_type, word_id, total_blanks, filled_blanks, correct_blanks, is_review) VALUES (?,?,?,?,?,?)'
      ).bind(a.type, a.id, total, filled, corr, a.review ? 1 : 0)
    )

    const cur = stateByType[a.type]?.get(a.id)
    if (!cur) continue
    const count = cur.attempt_count + 1
    let stage = cur.stage
    let due = null

    if (a.type === 'reading') {
      let streak = cur.val
      if (a.review) {
        if (stage === 'review1') {
          if (a.correct) { stage = 'review2'; due = "datetime('now','+3 days')" }
          else { stage = 'learning'; streak = 5 }
        } else if (stage === 'review2') {
          if (a.correct) stage = 'graduated'
          else { stage = 'review1'; due = "datetime('now','+2 days')" }
        }
      } else if (a.correct) {
        streak += 1
        if (streak >= 7) { stage = 'review1'; due = "datetime('now','+2 days')" }
      } else {
        streak = 0
      }
      stmts.push(buildUpdate(env, 'reading_words', 'streak', streak, count, stage, due, a.id))
    } else {
      let score = cur.val
      if (a.review) {
        if (stage === 'review1') {
          if (a.correct) { stage = 'review2'; due = "datetime('now','+3 days')" }
          else { stage = 'learning'; score -= 1 }
        } else if (stage === 'review2') {
          if (a.correct) stage = 'graduated'
          else { stage = 'review1'; due = "datetime('now','+2 days')" }
        }
      } else {
        const perfect = filled === total && corr === total
        if (perfect) {
          score += 0.5
          if (score >= 3) { stage = 'review1'; due = "datetime('now','+2 days')" }
        } else {
          const pen = a.type === 'kanji' ? kanjiPenalty(total, corr, filled) : onoPenalty(total, corr)
          score -= pen * protectFactor(cur.attempt_count)
        }
      }
      stmts.push(buildUpdate(env, TABLE[a.type], 'score', round2(score), count, stage, due, a.id))
    }
  }
  if (stmts.length) await env.DB.batch(stmts)

  // 错题本（错题全量存入 wrong_items）
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
