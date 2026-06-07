// GET /api/exam/start —— 有暂存的局则恢复，否则抽 30 表记 + 10 拟态混合打乱
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

  // 2) 否则抽新题
  const kanji = await env.DB.prepare(
    'SELECT id, hyoki, meaning FROM kanji_words WHERE score < 3 ORDER BY RANDOM() LIMIT 30'
  ).all()
  const ono = await env.DB.prepare(
    'SELECT id, body FROM onomatopoeia WHERE score < 3 ORDER BY RANDOM() LIMIT 10'
  ).all()

  const questions = []
  for (const k of kanji.results) {
    questions.push({ type: 'kanji', id: k.id, hyoki: k.hyoki, meaning: k.meaning })
  }
  for (const o of ono.results) {
    const { parts, answers } = parseOno(o.body)
    // 候选词去重：同一个词在段落里多次出现时只给一个（可重复填入多个空）
    questions.push({ type: 'ono', id: o.id, parts, choices: shuffle([...new Set(answers)]) })
  }

  return Response.json({ resumed: false, questions: shuffle(questions) })
}
