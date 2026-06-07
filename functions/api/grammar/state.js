// POST /api/grammar/state —— 更新某义项的学习标记(state) + 收起(collapsed)
// 入参：{ key, state, collapsed }（前端传完整当前值）
export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null)
  if (!data || !data.key) {
    return Response.json({ error: '参数错误' }, { status: 400 })
  }
  const state = data.state || 'new'
  const collapsed = data.collapsed ? 1 : 0

  if (state === 'new' && collapsed === 0) {
    // 全默认 → 不入库
    await env.DB.prepare('DELETE FROM grammar_state WHERE k = ?')
      .bind(data.key)
      .run()
  } else {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO grammar_state (k, state, collapsed) VALUES (?, ?, ?)'
    )
      .bind(data.key, state, collapsed)
      .run()
  }
  return Response.json({ ok: true })
}
