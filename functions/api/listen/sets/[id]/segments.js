// /api/listen/sets/:id/segments —— 小节的查询与整体保存
// 切割是「整体替换」语义：每次保存都用传入的切点列表覆盖该集全部小节

export async function onRequestGet({ env, params }) {
  const { results } = await env.DB.prepare(
    'SELECT id, seq, name, start_sec, end_sec FROM listening_segment WHERE set_id = ? ORDER BY seq'
  )
    .bind(params.id)
    .all()
  return Response.json(results)
}

export async function onRequestPut({ request, env, params }) {
  const id = params.id
  const data = await request.json().catch(() => null)
  if (!data || !Array.isArray(data.segments)) return jsonError('需要 segments 数组', 400)

  // 校验并归一化
  const segs = data.segments.map((s, i) => ({
    seq: Number.isFinite(s.seq) ? s.seq : i + 1,
    name: (s.name ?? '').trim() || null,
    start: Number(s.start_sec),
    end: Number(s.end_sec),
  }))
  for (const s of segs) {
    if (!Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end <= s.start) {
      return jsonError('小节时间区间不合法', 400)
    }
  }

  const stmts = [env.DB.prepare('DELETE FROM listening_segment WHERE set_id = ?').bind(id)]
  for (const s of segs) {
    stmts.push(
      env.DB
        .prepare(
          'INSERT INTO listening_segment (set_id, seq, name, start_sec, end_sec) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(id, s.seq, s.name, s.start, s.end)
    )
  }
  await env.DB.batch(stmts)
  return Response.json({ ok: true, count: segs.length })
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status })
}
