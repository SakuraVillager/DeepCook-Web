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
const dishes = [
  { title: '西班牙海鲜饭', photo: 'eu-paella.jpg', kind: '一锅丰盛 · 主食' },
  { title: '小笼包', photo: 'cn-xiaolongbao.jpg', kind: '热气腾腾 · 早餐' },
  {
    title: '红酒炖牛肉',
    photo: 'eu-beef-bourguignon.jpg',
    kind: '慢炖入味 · 荤菜',
  },
  { title: '提拉米苏', photo: 'eu-tiramisu.jpg', kind: '留一点甜 · 甜品' },
]

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
          className="android-hero android-wrap"
          aria-labelledby="android-title"
        >
          <div className="android-hero__copy" data-reveal>
            <p className="label android-eyebrow">
              <span /> DEEPCOOK / ANDROID APP
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
              从「今晚吃什么」到第一口热饭。
              <br />
              找一道喜欢的菜，跟着步骤，慢慢做出自己的味道。
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
                <b>AI</b> 一起下厨
              </span>
            </div>
          </div>
          <figure className="android-hero__visual" data-reveal>
            <span className="android-orbit" aria-hidden="true" />
            <div className="android-phone" aria-hidden="true">
              <div className="android-phone__status">
                <span>9:41</span>
                <span>••• ▰</span>
              </div>
              <div className="android-phone__brand">
                <span>炊</span> DeepCook <small>我的厨房</small>
              </div>
              <div className="android-phone__greeting">
                <small>好好吃饭，慢慢生活。</small>
                <strong>今天，想做点什么？</strong>
              </div>
              <div className="android-phone__search">
                ⌕ &nbsp; 搜索菜名、食材、做法
              </div>
              <div className="android-phone__tabs">
                <b>为你精选</b>
                <span>家常菜</span>
                <span>早餐</span>
              </div>
              <img
                className="android-phone__cover"
                src="../photos/eu-paella.jpg"
                alt=""
                width="640"
                height="426"
              />
              <div className="android-phone__dish">
                <strong>西班牙海鲜饭</strong>
                <span>把好食材，煮成一锅热闹。</span>
              </div>
              <div className="android-phone__bottom">
                <span>菜谱</span>
                <span>收藏</span>
                <span>我的</span>
              </div>
            </div>
            <div className="android-float-note">
              <span className="label">YOUR POCKET KITCHEN</span>
              <strong>离线也有好菜。</strong>
              <span>让下厨，从容一点。</span>
            </div>
            <figcaption>APP 界面示意 / 随手打开，就是厨房</figcaption>
          </figure>
        </section>

        <section
          className="android-pocket"
          id="pocket"
          aria-labelledby="pocket-title"
        >
          <div className="android-wrap">
            <div className="android-section-head" data-reveal>
              <div>
                <p className="label">01 / FIND YOUR NEXT FAVORITE</p>
                <h2 id="pocket-title">好菜，随时翻开。</h2>
              </div>
              <p>
                494 道菜谱随包收录。按菜名、食材和分类寻找，
                <br />
                把喜欢的收藏起来，让每一顿都有着落。
              </p>
            </div>
            <div className="android-dishes">
              {dishes.map((dish, index) => (
                <article className="android-dish" data-reveal key={dish.title}>
                  <div>
                    <img
                      src={`../photos/${dish.photo}`}
                      alt={dish.title}
                      loading="lazy"
                      width="640"
                      height="426"
                    />
                    <span className="label">0{index + 1}</span>
                  </div>
                  <h3>{dish.title}</h3>
                  <p>{dish.kind}</p>
                </article>
              ))}
            </div>
            <div className="android-pocket__foot">
              <span>OFFLINE FIRST / 好好吃饭，不必等信号。</span>
              <span>收藏喜欢的，也写下自己的拿手菜。</span>
            </div>
          </div>
        </section>

        <section
          className="android-reader android-wrap"
          id="reader"
          aria-labelledby="reader-title"
        >
          <div className="android-reader__copy" data-reveal>
            <p className="label">02 / ONE STEP AT A TIME</p>
            <h2 id="reader-title">
              手上忙，
              <br />
              心里有数。
            </h2>
            <p className="android-lead">
              把一道菜，拆成眼前这一步。
              <br />
              大字号、步骤目录、下厨计时，陪你从备菜走到上桌。
            </p>
            <ol className="android-feature-list">
              <li>
                <span>01</span>
                <div>
                  <h3>只看当前这一步</h3>
                  <p>分步阅读让注意力留在锅里，步骤目录随时跳转。</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>把时间交给计时器</h3>
                  <p>明确时长一键计时，多道菜同时准备也有条不紊。</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>记住你的拿手菜</h3>
                  <p>收藏常做的菜谱，记录自己的配方和口味偏好。</p>
                </div>
              </li>
            </ol>
          </div>
          <figure className="android-step" data-reveal>
            <div className="android-step__top">
              <span className="label">红烧肉 / 烹饪模式示意</span>
              <span>03 / 06</span>
            </div>
            <div className="android-step__progress">
              <i />
            </div>
            <span className="android-step__number serif">03</span>
            <h3>慢一点，让味道进去。</h3>
            <p>
              加入热水没过五花肉。大火煮开后转小火，盖上锅盖慢炖，等肉变得软糯。
            </p>
            <div className="android-step__timer">
              <span>◷ 小火慢炖</span>
              <strong>45:00</strong>
            </div>
            <div className="android-step__bottom">
              <span>← 上一步</span>
              <span>下一步 →</span>
            </div>
            <figcaption>阅读与计时界面示意</figcaption>
          </figure>
        </section>

        <section className="android-ai" id="ai" aria-labelledby="ai-title">
          <div className="android-wrap android-ai__grid">
            <div data-reveal>
              <p className="label">03 / A LITTLE HELP IN THE KITCHEN</p>
              <h2 id="ai-title">
                把 AI，
                <br />
                请进厨房。
              </h2>
              <p className="android-lead">
                冰箱里有什么，今晚想怎么吃？
                <br />
                从现有食材聊起，让 AI 帮你找灵感、理步骤、解答下厨时的疑问。
              </p>
              <LetterLink text="下载 APP 体验" href="#download" arrow />
            </div>
            <figure className="android-chat" data-reveal>
              <div className="android-chat__top">
                <span className="site-header__seal">炊</span>
                <span>厨房里的另一双手</span>
                <span>AI</span>
              </div>
              <p className="android-chat__user">
                只有番茄、鸡蛋和包菜，20 分钟能做点什么？
              </p>
              <p className="android-chat__answer">
                可以从番茄炒蛋和清炒包菜开始。先备好食材，再同时安排两道菜的火候。想先看看哪一道的步骤？
              </p>
              <div className="android-chat__hint">
                从一顿简单的晚饭开始。<span>↗</span>
              </div>
              <figcaption>AI 对话示意 · 需配置 AI 服务</figcaption>
            </figure>
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
              <span className="site-header__seal">炊</span>
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
            <a
              className="btn btn--ink"
              href={appDownload.url}
              download
            >
              服务器直接下载 <span aria-hidden="true">↓</span>
            </a>
            <a
              className="android-download__mirror"
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
