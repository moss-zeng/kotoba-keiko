// GET /api/exam/start —— 有暂存的局则恢复，否则抽常规题(score<3) + 到期复习题(score=3 且满15天)
import { parseOno, shuffle } from './_shared.js'

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

  // 2) 常规题：score < 3，随机抽 25 表记 + 5 拟态
  const kanji = await env.DB.prepare(
    'SELECT id, hyoki, meaning FROM kanji_words WHERE score < 3 ORDER BY RANDOM() LIMIT 25'
  ).all()
  const ono = await env.DB.prepare(
    'SELECT id, body FROM onomatopoeia WHERE score < 3 ORDER BY RANDOM() LIMIT 5'
  ).all()

  // 3) 复习题：score = 3 且距到达 3 分已满 15 天（额外，不占常规名额）
  const dueKanji = await env.DB.prepare(
    "SELECT id, hyoki, meaning FROM kanji_words WHERE score = 3 AND graduated_at IS NOT NULL AND datetime(graduated_at, '+15 days') <= datetime('now')"
  ).all()
  const dueOno = await env.DB.prepare(
    "SELECT id, body FROM onomatopoeia WHERE score = 3 AND graduated_at IS NOT NULL AND datetime(graduated_at, '+15 days') <= datetime('now')"
  ).all()

  const regular = []
  for (const k of kanji.results) {
    regular.push({ type: 'kanji', id: k.id, hyoki: k.hyoki, meaning: k.meaning })
  }
  for (const o of ono.results) {
    const { parts, answers } = parseOno(o.body)
    regular.push({ type: 'ono', id: o.id, parts, choices: shuffle([...new Set(answers)]) })
  }

  const review = []
  for (const k of dueKanji.results) {
    review.push({ type: 'kanji', id: k.id, hyoki: k.hyoki, meaning: k.meaning, review: true })
  }
  for (const o of dueOno.results) {
    const { parts, answers } = parseOno(o.body)
    review.push({
      type: 'ono',
      id: o.id,
      parts,
      choices: shuffle([...new Set(answers)]),
      review: true,
    })
  }

  // 常规打乱在前，复习题接在后面
  const questions = [...shuffle(regular), ...shuffle(review)]
  return Response.json({ resumed: false, questions })
}
