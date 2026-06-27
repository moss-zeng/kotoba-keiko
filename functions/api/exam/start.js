// GET /api/exam/start —— 有暂存则恢复；否则按桶抽常规题 + 到期复习题
// 分桶（仅 stage='learning'）：新题(attempt_count=0) / 负分 / 正分，固定配额，缺额按 新题>负分>正分 下放，同桶随机
// 复习题：stage∈(review1,review2) 且 review_due_at 到期，额外出、不占配额
import { parseOno, shuffle } from './_shared.js'

const TYPES = {
  kanji: { table: 'kanji_words', cols: 'id, hyoki, meaning', valCol: 'score' },
  reading: { table: 'reading_words', cols: 'id, kana, kanji, meanings', valCol: 'streak' },
  ono: { table: 'onomatopoeia', cols: 'id, body', valCol: 'score' },
}
const QUOTA = { kanji: [0, 0, 0], reading: [30, 20, 10], ono: [0, 0, 0] }

async function fetchBucket(env, table, cols, where, limit) {
  const { results } = await env.DB.prepare(
    `SELECT ${cols} FROM ${table} WHERE stage = 'learning' AND ${where} ORDER BY RANDOM() LIMIT ${limit}`
  ).all()
  return results
}

// 按桶取常规题：各桶先取本桶固定配额；任一桶不足产生的缺额，
// 按优先级(新题>负分>正分)再分配给仍有余量的桶，凑满整局总额
async function pickRegular(env, type) {
  const { table, cols, valCol } = TYPES[type]
  const quotas = QUOTA[type]
  const totalQuota = quotas.reduce((a, b) => a + b, 0)
  const negCond = valCol === 'streak' ? 'streak = 0' : 'score < 0'
  const posCond = valCol === 'streak' ? 'streak >= 1' : 'score >= 0'
  const wheres = [
    'attempt_count = 0',
    `attempt_count > 0 AND ${negCond}`,
    `attempt_count > 0 AND ${posCond}`,
  ]

  // 每桶都可能被要求补满整局，故各桶都先取到 totalQuota 个候选
  const pools = []
  for (const w of wheres) pools.push(await fetchBucket(env, table, cols, w, totalQuota))

  // 第一轮：各取本桶配额
  const takes = pools.map((p, i) => Math.min(quotas[i], p.length))
  let deficit = totalQuota - takes.reduce((a, b) => a + b, 0)
  // 第二轮：缺额按优先级补给仍有余量的桶
  for (let i = 0; i < pools.length && deficit > 0; i++) {
    const extra = Math.min(deficit, pools[i].length - takes[i])
    takes[i] += extra
    deficit -= extra
  }

  const chosen = []
  pools.forEach((p, i) => chosen.push(...p.slice(0, takes[i])))
  return chosen
}

async function fetchDue(env, type) {
  const { table, cols } = TYPES[type]
  const { results } = await env.DB.prepare(
    `SELECT ${cols} FROM ${table} WHERE stage IN ('review1','review2') AND review_due_at IS NOT NULL AND datetime(review_due_at) <= datetime('now') ORDER BY RANDOM()`
  ).all()
  return results
}

function toQuestion(type, row, review) {
  if (type === 'kanji') return { type, id: row.id, hyoki: row.hyoki, meaning: row.meaning, review }
  if (type === 'reading')
    return {
      type,
      id: row.id,
      kana: row.kana,
      kanji: row.kanji,
      meanings: JSON.parse(row.meanings || '[]'),
      review,
    }
  const { parts, answers } = parseOno(row.body)
  return { type, id: row.id, parts, choices: shuffle([...new Set(answers)]), review }
}

export async function onRequestGet({ env }) {
  // 1) 有暂存的未完成局 → 恢复
  const saved = await env.DB.prepare(
    'SELECT questions, answers FROM active_exam WHERE id = 1'
  ).first()
  if (saved) {
    return Response.json({
      resumed: true,
      questions: JSON.parse(saved.questions),
      answered: JSON.parse(saved.answers),
    })
  }

  // 2) 常规题分桶抽取 + 3) 复习题
  const regular = []
  const review = []
  for (const type of ['kanji', 'reading', 'ono']) {
    for (const row of await pickRegular(env, type)) regular.push(toQuestion(type, row, false))
    for (const row of await fetchDue(env, type)) review.push(toQuestion(type, row, true))
  }

  // 常规打乱在前，复习题接在后面
  const questions = [...shuffle(regular), ...shuffle(review)]
  return Response.json({ resumed: false, questions })
}


