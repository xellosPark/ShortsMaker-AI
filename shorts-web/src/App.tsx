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
      const v = await api.create(String(form.get('topic') ?? ''), String(form.get('voice') ?? 'none'))
      setVideos((list) => [v, ...list])
      setCurrentId(v.id)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }, null)

  // 삭제 확인은 브라우저 confirm() 대신 화면 안 대화상자로 (앱 내장 브라우저에선 confirm 이 바로 취소됨)
  const [pendingDelete, setPendingDelete] = useState<VideoMeta | null>(null)
  const askDelete = (id: string) => setPendingDelete(videos.find((v) => v.id === id) ?? null)

  const remove = async (id: string) => {
    // 재생 중인 파일은 Windows 에서 잠겨 지워지지 않으니 먼저 미리보기를 비운다
    if (currentId === id) setCurrentId(null)
    await api.remove(id)
    setVideos((list) => list.filter((v) => v.id !== id))
  }

  return (
    <>
      <main className="studio">
        <CreatePanel config={config} submit={submit} error={error} busy={busy} />
        <Stage video={current} onRemove={askDelete} />
        <ScriptPanel video={current} />
      </main>
      <Gallery videos={videos} currentId={currentId} onSelect={setCurrentId} onRemove={askDelete} />
      {pendingDelete && (
        <DeleteDialog video={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={remove} onDone={() => setPendingDelete(null)} />
      )}
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

        {topic.trim() && !isSample && !config.aiScript && (
          <p className="note">✍️ Gemini 키를 넣으면 직접 적은 주제도 주제에 맞는 AI 대본으로 만들어요. 지금은 기본 틀 대본이에요.</p>
        )}

        <div className="row-between">
          <span className="field-label">목소리</span>
          <button type="button" className="ghost small" onClick={random}>
            🎲 랜덤 주제
          </button>
        </div>
        <VoicePicker config={config} />

        <div className="features">
          <Feature on={config.aiScript} label="AI 대본" onText="Gemini" offText="키 필요" />
          <Feature on={config.stockVideo} label="배경 영상" onText={config.stockProviders.join(' · ')} offText="키 필요" />
          <Feature on label="음성" onText="Edge 신경망" offText="" />
        </div>

        <SubmitButton busy={busy} />
        {error && <p className="error">⚠️ {error}</p>}
      </form>
    </section>
  )
}

function VoicePicker({ config }: { config: AppConfig }) {
  const [voice, setVoice] = useState(config.defaultVoice)
  const [playing, setPlaying] = useState<string | null>(null)
  const [audio] = useState(() => new Audio())

  useEffect(() => {
    const stop = () => setPlaying(null)
    audio.addEventListener('ended', stop)
    audio.addEventListener('error', stop)
    return () => {
      audio.pause()
      audio.removeEventListener('ended', stop)
      audio.removeEventListener('error', stop)
    }
  }, [audio])

  const preview = (id: string) => {
    if (playing === id) {
      audio.pause()
      setPlaying(null)
      return
    }
    audio.src = api.voicePreviewUrl(id)
    void audio.play().catch(() => setPlaying(null))
    setPlaying(id)
  }

  return (
    <div className="voices" role="radiogroup" aria-label="목소리">
      <input type="hidden" name="voice" value={voice} />
      {config.voices.map((v) => (
        <div
          key={v.id}
          role="radio"
          aria-checked={voice === v.id}
          tabIndex={0}
          className={`voice ${voice === v.id ? 'active' : ''}`}
          onClick={() => setVoice(v.id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setVoice(v.id)}
        >
          <span className="voice-name">{v.name}</span>
          <span className="voice-desc">{v.desc}</span>
          <button
            type="button"
            className={`play ${playing === v.id ? 'on' : ''}`}
            title="미리듣기"
            onClick={(e) => {
              e.stopPropagation()
              preview(v.id)
            }}
          >
            {playing === v.id ? '■' : '▶'}
          </button>
        </div>
      ))}
      <div
        role="radio"
        aria-checked={voice === 'none'}
        tabIndex={0}
        className={`voice mute ${voice === 'none' ? 'active' : ''}`}
        onClick={() => setVoice('none')}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setVoice('none')}
      >
        <span className="voice-name">🔇</span>
        <span className="voice-desc">자막만</span>
      </div>
    </div>
  )
}

function Feature({ on, label, onText, offText }: { on: boolean; label: string; onText: string; offText: string }) {
  return (
    <span className={`feature ${on ? 'on' : ''}`}>
      <i />
      {label} <b>{on ? onText : offText}</b>
    </span>
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
  { at: 12, label: '음성' },
  { at: 22, label: '배경' },
  { at: 30, label: '렌더링' },
  { at: 100, label: '완료' },
]

function Stage({ video, onRemove }: { video: VideoMeta | null; onRemove: (id: string) => void }) {
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

      {video && (video.status === 'done' || video.status === 'failed') && (
        <div className="stage-actions">
          {video.status === 'done' && video.videoUrl && (
            <a className="ghost" href={video.videoUrl} download={`${video.topic}.mp4`}>
              ⬇ MP4 다운로드
            </a>
          )}
          <button
            type="button"
            className="ghost danger"
            onClick={() => onRemove(video.id)}
          >
            <TrashIcon /> 삭제
          </button>
          {video.durationSec && <span className="meta">{video.durationSec}초 · 1080×1920</span>}
        </div>
      )}
    </section>
  )
}

/* ───────────── 대본 ───────────── */

const VOICE_NAMES: Record<string, string> = { sunhi: '선히', injoon: '인준', hyunsu: '현수' }
const voiceLabel = (v: VideoMeta) =>
  typeof v.voice === 'string'
    ? `${VOICE_NAMES[v.voice] ?? v.voice}${v.voiceEngine === 'windows' ? ' (Windows)' : ''}`
    : 'Windows 음성'

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
            <span className="tag">
              {video.scriptSource === 'ai' ? '✨ AI 대본' : video.scriptSource === 'sample' ? '추천 대본' : '기본 틀 대본'}
            </span>
            <span className="tag">{video.voice ? `🔊 ${voiceLabel(video)}` : '🔇 자막만'}</span>
            {video.background && <span className="tag">{video.background === 'stock' ? '🎞 스톡 배경' : '🎨 그라데이션'}</span>}
            <span className="tag">장면 {video.scenes.length}개</span>
          </div>
          {video.notes && video.notes.length > 0 && (
            <ul className="notes">
              {video.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <ol className="scenes">
            {video.scenes.map((s, i) => (
              <li key={i}>
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  {s.label && <span className="label">{s.label}</span>}
                  <strong>{s.title}</strong>
                  <p>{s.caption}</p>
                  {(s.bgCredit || s.keyword) && (
                    <span className="credit">🎞 {s.bgCredit ?? `검색어: ${s.keyword}`}</span>
                  )}
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

function DeleteDialog({
  video,
  onCancel,
  onConfirm,
  onDone,
}: {
  video: VideoMeta
  onCancel: () => void
  onConfirm: (id: string) => Promise<void>
  onDone: () => void
}) {
  const [state, setState] = useState<'idle' | 'deleting' | string>('idle')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && state !== 'deleting' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, state])

  const confirm = async () => {
    setState('deleting')
    try {
      await onConfirm(video.id)
      onDone()
    } catch (e) {
      setState(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="dialog-backdrop" onClick={() => state !== 'deleting' && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="del-title" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-icon">
          <TrashIcon />
        </div>
        <h3 id="del-title">영상을 삭제할까요?</h3>
        <p className="dialog-topic">
          {video.emoji} {video.topic}
        </p>
        <p className="muted">삭제하면 영상 파일까지 지워지고 되돌릴 수 없어요.</p>
        {state !== 'idle' && state !== 'deleting' && <p className="error">⚠️ 삭제하지 못했어요: {state}</p>}
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={state === 'deleting'}>
            취소
          </button>
          <button type="button" className="danger-solid" onClick={confirm} disabled={state === 'deleting'} autoFocus>
            {state === 'deleting' ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M9 3h6m-9 4h12m-1 0-.7 11.2a2 2 0 0 1-2 1.8H9.7a2 2 0 0 1-2-1.8L7 7m3 4v5m4-5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
              {v.status !== 'queued' && v.status !== 'rendering' && (
                <button
                  type="button"
                  className="card-delete"
                  title="삭제"
                  aria-label={`${v.topic} 삭제`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(v.id)
                  }}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
            <div className="card-body">
              <p className="card-title">
                {v.emoji} {v.topic}
              </p>
              <div className="card-foot">
                <span>{timeAgo(v.createdAt)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
