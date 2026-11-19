import { Component, Suspense, use, useState, type ReactNode } from 'react'
import { fetchHealth, type HealthResponse } from './api/health'
import './App.css'

function HealthStatus({ promise }: { promise: Promise<HealthResponse> }) {
  const health = use(promise)
  return (
    <p className="status ok">
      ● API 연결됨 · {health.service} · 가동 {health.uptimeSec}초
    </p>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return <p className="status fail">● API 연결 실패 ({this.state.error.message})</p>
    }
    return this.props.children
  }
}

export default function App() {
  const [promise, setPromise] = useState(fetchHealth)
  const [attempt, setAttempt] = useState(0)

  const retry = () => {
    setPromise(fetchHealth())
    setAttempt((n) => n + 1)
  }

  return (
    <main className="app">
      <h1>🎬 ShortsMaker AI</h1>
      <p className="sub">5분 완성 유튜브 쇼츠 자동 생성기</p>
      <section className="card">
        <h2>서버 상태</h2>
        <ErrorBoundary key={attempt}>
          <Suspense fallback={<p className="status">● 확인 중…</p>}>
            <HealthStatus promise={promise} />
          </Suspense>
        </ErrorBoundary>
        <button onClick={retry}>다시 확인</button>
      </section>
    </main>
  )
}
