// GET /api/history —— 列出全部考试场次（最近的在前），含错题详情
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, finished_at, total, correct, wrong_items FROM exam_history ORDER BY id DESC'
  ).all()

  const list = results.map((r) => ({
    id: r.id,
    finished_at: r.finished_at,
    total: r.total,
    correct: r.correct,
    wrong: JSON.parse(r.wrong_items || '[]'),
  }))
  return Response.json(list)
}
