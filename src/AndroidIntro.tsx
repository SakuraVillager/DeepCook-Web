import { BrandMark } from './components/BrandMark'
import { appDownload } from './data/app-download'
import { useEffect } from 'react'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { Cursor } from './components/Cursor'
import { LetterLink } from './components/LetterLink'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import { useReveal } from './hooks/useReveal'

const navigation = {
  items: [
    { href: '#pocket', zh: '随身菜谱', en: 'RECIPES' },
    { href: '#reader', zh: '专心下厨', en: 'COOK' },
    { href: '#ai', zh: 'AI 下厨', en: 'AI' },
  ],
  cta: { text: '下载 APP', href: '#download' },
}
function AppScreen({
  name,
  alt,
  caption,
  eager = false,
}: {
  name: 'find' | 'cook' | 'ai'
  alt: string
  caption: string
  eager?: boolean
}) {
  return (
    <figure
      className={`android-feature__visual android-feature__visual--${name}`}
      data-reveal
    >
      <div className="android-screen-stage">
        <div className="android-screen-frame">
          <img
            className="android-screen"
            src={`../android/screens/${name}.png`}
            alt={alt}
            width="1024"
            height="2048"
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : undefined}
          />
        </div>
        <span className="android-screen-index" aria-hidden="true">
          {name === 'find' ? '01' : name === 'cook' ? '02' : '03'}
        </span>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

export function AndroidIntro() {
  const reduced = useReducedMotion()
  useSmoothScroll(!reduced)
  useReveal(true)
  useEffect(() => {
    // React creates the section after the browser's first fragment lookup.
    const hash = window.location.hash
    if (!hash) return
    let stopped = false,
      frame = 0
    const align = () => {
      void document.fonts.ready.then(() => {
        if (stopped || window.location.hash !== hash) return
        frame = requestAnimationFrame(() => {
          let id = ''
          try {
            id = decodeURIComponent(hash.slice(1))
          } catch {
            return
          }
          document.getElementById(id)?.scrollIntoView({ behavior: 'instant' })
        })
      })
    }
    if (document.readyState === 'complete') align()
    else window.addEventListener('load', align, { once: true })
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      window.removeEventListener('load', align)
    }
  }, [])
  return (
    <>
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <Cursor reduced={reduced} />
      <Header page={navigation} />
      <main id="main" className="android-intro">
        <section
          className="android-feature android-hero"
          id="pocket"
          aria-labelledby="android-title"
        >
          <div className="android-feature__grid android-wrap">
            <div className="android-feature__copy" data-reveal>
              <p className="label android-eyebrow">
                01 / RECIPES IN YOUR POCKET
              </p>
              <h1 id="android-title">
                把厨房，
                <br />
                装进<span>口袋。</span>
              </h1>
              <p className="android-hero__serif serif">
                Good food. Always with you.
              </p>
              <p className="android-lead">
                今晚吃什么，从一道喜欢的菜开始。
                <br />
                494 道随身菜谱，按菜名、食材和分类寻找。
                <br />
                收藏常做的味道，没信号时也能翻开。
              </p>
              <div className="android-actions">
                <a className="btn btn--ink" href="#download">
                  下载 Android 版 <span className="arrow" aria-hidden="true" />
                </a>
                <LetterLink text="先用在线版" href="../app/" arrow />
              </div>
              <div className="android-hero__facts">
                <span>
                  <b>494</b> 道随身菜谱
                </span>
                <span>
                  <b>离线</b> 也能翻阅
                </span>
                <span>
                  <b>同步</b> 你的厨房
                </span>
              </div>
            </div>
            <AppScreen
              name="find"
              eager
              alt="DeepCook 找菜功能示意：菜名与食材搜索、分类筛选和双列菜谱卡片"
              caption="找菜与收藏 / APP 功能界面示意"
            />
          </div>
        </section>

        <section
          className="android-feature android-feature--reverse android-feature--cook"
          id="reader"
          aria-labelledby="reader-title"
        >
          <div className="android-feature__grid android-wrap">
            <div className="android-feature__copy" data-reveal>
              <p className="label">02 / ONE STEP AT A TIME</p>
              <h2 id="reader-title">
                手上忙，
                <br />
                心里有数。
              </h2>
              <p className="android-lead">
                把一道菜，拆成眼前这一步。
                <br />
                做到哪里，就看到哪里。让注意力留给锅里，
                <br />
                把等待交给计时器。
              </p>
              <ol className="android-feature-list">
                <li>
                  <span>01</span>
                  <div>
                    <h3>眼前这一步，看得清楚</h3>
                    <p>大字号、步骤图片与目录跳转，跟上自己的下厨节奏。</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <h3>慢炖、焖煮，各有提醒</h3>
                    <p>从步骤时长开始计时，也可同时添加多个计时器。</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h3>回来，接着做</h3>
                    <p>恢复上次阅读的位置，常做的菜也不用从头翻找。</p>
                  </div>
                </li>
              </ol>
              <LetterLink text="带进我的厨房" href="#download" arrow />
            </div>
            <AppScreen
              name="cook"
              alt="DeepCook 做菜模式示意：红烧肉当前步骤、步骤目录和下厨计时器"
              caption="分步做菜与计时 / APP 功能界面示意"
            />
          </div>
        </section>

        <section
          className="android-feature android-feature--ai"
          id="ai"
          aria-labelledby="ai-title"
        >
          <div className="android-feature__grid android-wrap">
            <div className="android-feature__copy" data-reveal>
              <p className="label">03 / A LITTLE HELP IN THE KITCHEN</p>
              <h2 id="ai-title">
                把 AI，
                <br />
                请进厨房。
              </h2>
              <p className="android-lead">
                缺一样材料，临时多一位客人，
                <br />
                或者锅里的味道和想象不太一样。
                <br />
                下厨遇到的小问题，就在菜谱里问一问。
              </p>
              <ol className="android-feature-list">
                <li>
                  <span>01</span>
                  <div>
                    <h3>几个人吃，就准备几人份</h3>
                    <p>按人数换算材料用量，调味再跟着自己的口味微调。</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <h3>少一味，也有新办法</h3>
                    <p>常见调料先查本地经验，其他缺料问题交给 AI 帮忙。</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h3>哪儿不对，边做边问</h3>
                    <p>结合当前菜谱解答疑问；网络不顺时，仍可查看菜谱原文。</p>
                  </div>
                </li>
              </ol>
              <LetterLink text="下载 APP 体验" href="#download" arrow />
            </div>
            <AppScreen
              name="ai"
              alt="DeepCook AI 下厨功能示意：人数换算、缺料替代和问 AI 建议面板"
              caption="AI 功能界面示意 / 在线回答需配置 AI 服务"
            />
          </div>
        </section>

        <section
          className="android-download android-wrap"
          id="download"
          aria-labelledby="download-title"
        >
          <div data-reveal>
            <p className="label">READY WHEN YOU ARE / ANDROID</p>
            <h2 id="download-title">
              下一顿，
              <br />
              从这里开始。
            </h2>
            <p className="android-lead">下载 DeepCook，把喜欢的菜带进厨房。</p>
          </div>
          <div className="android-download__card" data-reveal>
            <div className="android-download__heading">
              <span className="site-header__seal">
                <BrandMark />
              </span>
              <div>
                <h3>DeepCook for Android</h3>
                <p>正式版 · v{appDownload.version}</p>
              </div>
            </div>
            <div className="android-download__specs">
              <span>
                ANDROID <b>8.0+</b>
              </span>
              <span>
                APK <b>{appDownload.sizeLabel}</b>
              </span>
              <span>
                菜谱 <b>494 道</b>
              </span>
            </div>
            <a className="btn btn--ink" href={appDownload.url} download>
              服务器直接下载 <span aria-hidden="true">↓</span>
            </a>
            <a
              className="btn btn--ink android-download__mirror"
              href={appDownload.githubUrl}
            >
              GitHub 下载 <span aria-hidden="true">↗</span>
            </a>
            <p className="android-download__note">
              安装包使用正式签名。首次使用需联网注册或登录；旧调试版请先同步资料，卸载后再安装本正式版。
            </p>
            <a className="android-download__web" href="../app/">
              也可以先用浏览器打开 <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>
      <Footer homeHref="../index.html" assetPrefix="../" />
      <div className="grain" aria-hidden="true" />
    </>
  )
}
