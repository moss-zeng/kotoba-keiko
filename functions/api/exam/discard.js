// POST /api/exam/discard —— 作废：清空暂存，不算分
export async function onRequestPost({ env }) {
  await env.DB.prepare('DELETE FROM active_exam WHERE id = 1').run()
  return Response.json({ ok: true })
}
