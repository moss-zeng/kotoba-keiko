// GET /api/grammar —— 解析当前语法原文 + 合并学习标记，返回展示结构
import { parseGrammar, itemKey } from './_grammar.js'

export async function onRequestGet({ env }) {
  const doc = await env.DB.prepare(
    'SELECT text FROM grammar_doc WHERE id = 1'
  ).first()
  const rows = parseGrammar(doc ? doc.text : '')

  const { results } = await env.DB.prepare(
    'SELECT k, state, collapsed FROM grammar_state'
  ).all()
  const stateMap = {}
  for (const r of results)
    stateMap[r.k] = { state: r.state, collapsed: r.collapsed === 1 }

  for (const row of rows) {
    for (const p of row.points) {
      for (const g of p.groups) {
        for (const it of g.items) {
          it.key = itemKey(p.title, g.pos, it.meaning)
          const m = stateMap[it.key]
          it.state = m ? m.state : 'new'
          it.collapsed = m ? m.collapsed : false
        }
      }
    }
  }

  return Response.json(rows)
}
