import { useState } from 'react'
import { Loader } from './components/Loader'
import { Cursor } from './components/Cursor'
import { Header } from './components/Header'
import { HeatRail } from './components/HeatRail'
import { Hero } from './components/Hero'
import { Manifesto } from './components/Manifesto'
import { Find } from './components/Find'
import { Cook } from './components/Cook'
import { Understand } from './components/Understand'
import { Roadmap } from './components/Roadmap'
import { Download } from './components/Download'
import { Footer } from './components/Footer'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import { useReveal } from './hooks/useReveal'

function hasSeenIntro() {
  try {
    return window.sessionStorage.getItem('deepcook-intro') === '1'
  } catch {
    return false
  }
}

export default function App() {
  const reduced = useReducedMotion()
  const [skipIntro] = useState(hasSeenIntro)
  const [loaderDone, setLoaderDone] = useState(skipIntro)
  const introDone = reduced || loaderDone || skipIntro

  useSmoothScroll(!reduced)
  useReveal(introDone)

  const finishIntro = () => {
    setLoaderDone(true)
    try {
      window.sessionStorage.setItem('deepcook-intro', '1')
    } catch {
      // Session storage is optional; the loader simply runs again.
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>

      {!introDone && <Loader reduced={reduced} onDone={finishIntro} />}

      <Cursor reduced={reduced} />
      <Header />
      <HeatRail />

      <main id="main">
        <Hero play={introDone} reduced={reduced} />
        <Manifesto />
        <Find />
        <Cook />
        <Understand />
        <Roadmap />
        <Download />
      </main>

      <Footer />

      <div className="grain" aria-hidden="true" />
    </>
  )
}
