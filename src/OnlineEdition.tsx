import { LetterLink } from './components/LetterLink'
import { DesignCanvas } from './components/DesignCanvas'

export default function OnlineEdition() {
  return (
    <div className="online canvas-page canvas-page--online">
      <a className="skip-link" href="#online-main">跳到主要内容</a>
      <DesignCanvas className="online__canvas" label="在线入口画布">
      <header className="online__header">
        <a className="online__brand" href="../index.html" aria-label="DeepCook 首页">
          <span className="online__seal" aria-hidden="true">炊</span>
          <span className="online__word">DEEPCOOK</span>
        </a>
        <span className="online__edition label" lang="en">THE ONLINE EDITION</span>
        <LetterLink text="返回首页" href="../index.html" className="online__back" arrow />
      </header>

      <main id="online-main" className="online__main">
        <section className="online__intro" aria-labelledby="online-title">
          <div className="online__heading">
            <div className="online__eyebrow">
              <p className="label">ONLINE EDITION <span aria-hidden="true">/</span> 在线版</p>
              <span className="online__state"><i aria-hidden="true" />准备中</span>
            </div>
            <h1 id="online-title" className="online__title">
              <span>正在</span><span className="online__title-accent">备菜。</span>
            </h1>
          </div>

          <figure className="online__visual">
            <div className="online__photo">
              <img src="../photos/cn-xiaolongbao.jpg" alt="蒸笼里热气腾腾的小笼包" width="1200" height="1600" fetchPriority="high" />
            </div>
            <figcaption>
              <span className="online__caption-title" lang="en">Kitchen in preparation.</span>
              <span className="label">EST. 2026</span>
            </figcaption>
          </figure>

          <div className="online__story">
            <span className="online__story-index label" aria-hidden="true">A LITTLE PATIENCE,<br /> A BETTER KITCHEN.</span>
            <p>
              你已经走到了 DeepCook 的在线版入口。网页版还在准备中——同一份 494 道离线菜谱，
              加上浏览器里的浏览、搜索和烹饪模式，会把厨房原样搬过来。
            </p>
          </div>
        </section>

        <section className="online__download" aria-labelledby="download-title">
          <div className="online__download-label">
            <span className="label">IN THE MEANTIME</span>
            <span className="online__platform label">ANDROID <span aria-hidden="true">↗</span></span>
          </div>
          <div className="online__download-copy">
            <h2 id="download-title">先把好好吃饭，<br className="online__mobile-break" />装进口袋。</h2>
            <p>现在可以先下载 Android 版，完整功能都在那里。</p>
          </div>
          <div className="online__actions">
            <LetterLink
              text="下载 Android 版"
              href="../download/DeepCook-0.5.1-preview.apk"
              download
              className="btn online__download-button"
              arrow
            />
            <LetterLink text="回到首页" href="../index.html" className="online__home-link" arrow />
          </div>
        </section>
      </main>

      <footer className="status">
        <span><i className="dot" />ONLINE EDITION · IN PROGRESS</span>
        <span>494 RECIPES · OFFLINE FIRST</span>
        <span className="foot">DEEPCOOK © 2026</span>
      </footer>
      </DesignCanvas>
    </div>
  )
}
