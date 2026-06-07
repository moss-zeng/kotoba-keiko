// /api/history/:id —— 删除一条考试记录
export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM exam_history WHERE id = ?')
    .bind(params.id)
    .run()
  return Response.json({ ok: true })
}
