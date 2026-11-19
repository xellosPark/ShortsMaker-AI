import { Suspense, use, useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { api, hex, type AppConfig, type VideoMeta } from './api/client'
import './App.css'

const configPromise = api.config()

export default function App() {
  return (
    <div className="shell">
      <TopBar />
      <Suspense fallback={<div className="boot">스튜디오 준비 중…</div>}>
        <Studio configPromise={configPromise} />
      </Suspense>
    </div>
  )
}

/* ───────────── 상단 바 ───────────── */

function TopBar() {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    const check = () => api.health().then(() => setOk(true), () => setOk(false))
    check()
    const t = setInterval(check, 15000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden>
          <svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
        </span>
        <span className="brand-name">ShortsMaker <b>AI</b></span>
        <span className="beta">BETA</span>
      </div>
      <span className={`pill ${ok === null ? '' : ok ? 'on' : 'off'}`}>
        <i />
        {ok === null ? '연결 확인 중' : ok ? '서버 연결됨' : '서버 꺼짐'}
      </span>
    </header>
  )
}

/* ───────────── 스튜디오 ───────────── */

function Studio({ configPromise }: { configPromise: Promise<AppConfig> }) {
  const config = use(configPromise)
  const [videos, setVideos] = useState<VideoMeta[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const current = videos.find((v) => v.id === currentId) ?? null
  const busy = videos.some((v) => v.status === 'queued' || v.status === 'rendering')

  // 목록 불러오기 + 렌더링 중이면 1초마다 갱신
  useEffect(() => {
    let alive = true
    const load = () =>
      api.list().then((list) => {
        if (!alive) return
        setVideos(list)
        setCurrentId((id) => id ?? list.find((v) => v.status === 'done')?.id ?? null)
      })
    load()
    const t = setInterval(load, busy ? 1000 : 10000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [busy])

  const [error, submit] = useActionState(async (_prev: string | null, form: FormData) => {
    try {
      const v = await api.create(String(form.get('topic') ?? ''), form.get('voice') === 'on')
      setVideos((list) => [v, ...list])
      setCurrentId(v.id)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }, null)

  const remove = async (id: string) => {
    await api.remove(id)
    setVideos((list) => list.filter((v) => v.id !== id))
    if (currentId === id) setCurrentId(null)
  }

  return (
    <>
      <main className="studio">
        <CreatePanel config={config} submit={submit} error={error} busy={busy} />
        <Stage video={current} />
        <ScriptPanel video={current} />
      </main>
      <Gallery videos={videos} currentId={currentId} onSelect={setCurrentId} onRemove={remove} />
    </>
  )
}

/* ───────────── 만들기 ───────────── */

function CreatePanel({
  config,
  submit,
  error,
  busy,
}: {
  config: AppConfig
  submit: (form: FormData) => void
  error: string | null
  busy: boolean
}) {
  const [topic, setTopic] = useState('')
  const isSample = config.samples.some((s) => s.topic === topic.trim())
  const random = () => {
    const others = config.samples.filter((s) => s.topic !== topic)
    setTopic(others[Math.floor(Math.random() * others.length)].topic)
  }

  return (
    <section className="panel create">
      <span className="eyebrow">STEP 1 · 주제 고르기</span>
      <h1>
        어떤 <em>쇼츠</em>를
        <br />
        만들어 볼까요?
      </h1>
      <p className="muted">주제를 적거나 추천 주제를 눌러 보세요. 비워 두면 랜덤으로 골라 드려요.</p>

      <form action={submit} className="form">
        <div className="field">
          <textarea
            name="topic"
            rows={2}
            maxLength={60}
            placeholder="예: 아침에 일찍 일어나는 법"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <span className="count">{topic.length}/60</span>
        </div>

        <div className="chips">
          {config.samples.map((s) => (
            <button
              type="button"
              key={s.topic}
              className={`chip ${topic === s.topic ? 'active' : ''}`}
              onClick={() => setTopic(s.topic)}
            >
              <span>{s.emoji}</span>
              {s.topic}
            </button>
          ))}
        </div>

        {topic.trim() && !isSample && (
          <p className="note">✍️ 직접 적은 주제는 지금은 기본 틀 대본으로 만들어요. AI 대본은 다음 단계에서 붙일게요.</p>
        )}

        <div className="options">
          <label className={`switch ${config.voiceAvailable ? '' : 'disabled'}`}>
            <input type="checkbox" name="voice" defaultChecked={config.voiceAvailable} disabled={!config.voiceAvailable} />
            <span className="track"><span className="thumb" /></span>
            <span>
              AI 내레이션
              <small>{config.voiceAvailable ? '한국어 음성 (무료)' : '이 서버에서는 아직 지원 안 해요'}</small>
            </span>
          </label>
          <button type="button" className="ghost" onClick={random}>
            🎲 랜덤 주제
          </button>
        </div>

        <SubmitButton busy={busy} />
        {error && <p className="error">⚠️ {error}</p>}
      </form>
    </section>
  )
}

function SubmitButton({ busy }: { busy: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="primary" disabled={pending || busy}>
      {pending ? '요청 중…' : busy ? '영상 만드는 중…' : '✨ 영상 만들기'}
    </button>
  )
}

/* ───────────── 미리보기 ───────────── */

const STEPS = [
  { at: 0, label: '대본' },
  { at: 10, label: '음성' },
  { at: 30, label: '렌더링' },
  { at: 100, label: '완료' },
]

function Stage({ video }: { video: VideoMeta | null }) {
  const bg = video ? `linear-gradient(160deg, ${hex(video.palette[0])}, ${hex(video.palette[1])})` : undefined

  return (
    <section className="stage">
      <div className="phone">
        <div className="screen" style={{ background: bg }}>
          {!video && (
            <div className="empty">
              <div className="empty-icon">🎬</div>
              <p>
                여기에 만든 영상이
                <br />
                나타나요
              </p>
            </div>
          )}

          {video && video.status === 'done' && video.videoUrl && (
            <video key={video.id} src={video.videoUrl} controls autoPlay playsInline />
          )}

          {video && (video.status === 'queued' || video.status === 'rendering') && (
            <div className="rendering">
              <div className="ring" style={{ ['--p' as string]: video.progress }}>
                <span>{video.progress}%</span>
              </div>
              <p className="rendering-step">{video.step}</p>
              <ol className="steps">
                {STEPS.map((s, i) => {
                  const next = STEPS[i + 1]?.at ?? 101
                  const state = video.progress >= next ? 'done' : video.progress >= s.at ? 'now' : ''
                  if (s.label === '음성' && !video.voice) return null
                  return (
                    <li key={s.label} className={state}>
                      {s.label}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {video && video.status === 'failed' && (
            <div className="empty">
              <div className="empty-icon">😵</div>
              <p>만들지 못했어요</p>
              <small className="fail-msg">{video.error}</small>
            </div>
          )}
        </div>
      </div>

      {video?.status === 'done' && video.videoUrl && (
        <div className="stage-actions">
          <a className="ghost" href={video.videoUrl} download={`${video.topic}.mp4`}>
            ⬇ MP4 다운로드
          </a>
          <span className="meta">
            {video.durationSec}초 · 1080×1920
          </span>
        </div>
      )}
    </section>
  )
}

/* ───────────── 대본 ───────────── */

function ScriptPanel({ video }: { video: VideoMeta | null }) {
  return (
    <section className="panel script">
      <span className="eyebrow">STEP 2 · 대본</span>
      {!video ? (
        <p className="muted">영상을 만들면 장면별 대본이 여기에 보여요.</p>
      ) : (
        <>
          <h2>
            <span>{video.emoji}</span> {video.topic}
          </h2>
          <div className="tags">
            <span className="tag">{video.scriptSource === 'sample' ? '추천 대본' : '기본 틀 대본'}</span>
            <span className="tag">{video.voice ? '🔊 내레이션' : '🔇 자막만'}</span>
            <span className="tag">장면 {video.scenes.length}개</span>
          </div>
          <ol className="scenes">
            {video.scenes.map((s, i) => (
              <li key={i}>
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  {s.label && <span className="label">{s.label}</span>}
                  <strong>{s.title}</strong>
                  <p>{s.caption}</p>
                </div>
                {s.durationSec && <span className="dur">{s.durationSec.toFixed(1)}s</span>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

/* ───────────── 내 영상 ───────────── */

const timeAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}시간 전` : `${Math.round(h / 24)}일 전`
}

function Gallery({
  videos,
  currentId,
  onSelect,
  onRemove,
}: {
  videos: VideoMeta[]
  currentId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}) {
  if (videos.length === 0) return null
  return (
    <section className="gallery">
      <div className="gallery-head">
        <h3>내 영상</h3>
        <span className="muted">{videos.length}개</span>
      </div>
      <div className="grid">
        {videos.map((v) => (
          <article
            key={v.id}
            className={`card ${v.id === currentId ? 'selected' : ''}`}
            onClick={() => onSelect(v.id)}
          >
            <div
              className="thumb"
              style={{ background: `linear-gradient(160deg, ${hex(v.palette[0])}, ${hex(v.palette[1])})` }}
            >
              {v.status === 'done' && v.videoUrl ? (
                <video
                  src={`${v.videoUrl}#t=1.2`}
                  muted
                  playsInline
                  preload="metadata"
                  onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => e.currentTarget.pause()}
                />
              ) : (
                <span className="thumb-state">{v.status === 'failed' ? '실패' : `${v.progress}%`}</span>
              )}
              {v.durationSec && <span className="badge">{Math.round(v.durationSec)}초</span>}
            </div>
            <div className="card-body">
              <p className="card-title">
                {v.emoji} {v.topic}
              </p>
              <div className="card-foot">
                <span>{timeAgo(v.createdAt)}</span>
                {v.status !== 'queued' && v.status !== 'rendering' && (
                  <button
                    type="button"
                    className="icon"
                    title="삭제"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('이 영상을 삭제할까요?')) onRemove(v.id)
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
