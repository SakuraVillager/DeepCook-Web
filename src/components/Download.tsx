export function Download() {
  return (
    <section className="section download" id="download" data-theme="light">
      <div className="container">
        <div className="download__head">
          <div>
            <div className="sec-head__label" style={{ paddingTop: 0, marginBottom: 20 }}>
              <span className="heat-tag">上桌 · SERVE</span>
              <span className="label">07 / GET IT</span>
            </div>
            <h2 className="download__title" data-reveal>
              把厨房，
              <br />
              <span className="serif">装进口袋。</span>
            </h2>
          </div>
          <p className="body-lg" style={{ maxWidth: 340 }} data-reveal>
            装进手机，或者直接在浏览器里打开。
            两种方式，同一间厨房。
          </p>
        </div>

        <div className="download__grid">
          <a
            className="download-card download-card--apk"
            href="./download/DeepCook-0.5.1-preview.apk"
            download
            data-reveal
          >
            <div className="download-card__top">
              <span className="download-card__num">01 / ON YOUR PHONE</span>
              <span className="download-card__num">APK</span>
            </div>
            <div>
              <h3>下载 Android 版</h3>
              <p>
                494 道菜谱随包提供，第一次打开就能用。
                Preview 构建可直接覆盖开发版安装。
              </p>
              <span className="btn btn--ghost">
                下载 APK
                <span className="arrow" aria-hidden="true" />
              </span>
            </div>
            <div className="download-card__bottom">
              <div className="download-card__meta">
                VERSION 0.5.1 · 17.5 MB
                <br />
                ANDROID 8.0+ · PREVIEW
              </div>
              <span className="download-card__arrow" aria-hidden="true">
                ↓
              </span>
            </div>
          </a>

          <a className="download-card download-card--web" href="./app/" data-reveal>
            <div className="download-card__top">
              <span className="download-card__num">02 / IN YOUR BROWSER</span>
              <span className="download-card__num">WEB</span>
            </div>
            <div>
              <h3>不装，也能用。</h3>
              <p>
                在线版正在准备中。入口已经留好，厨房收拾完就开火。
                现在打开可以先看到我们的准备进度。
              </p>
              <span className="btn btn--ghost">
                在线使用
                <span className="arrow" aria-hidden="true" />
              </span>
            </div>
            <div className="download-card__bottom">
              <div className="download-card__meta">
                ONLINE · BETA PREP
                <br />
                无需安装 · 浏览器直接打开
              </div>
              <span className="download-card__arrow" aria-hidden="true">
                ↗
              </span>
            </div>
          </a>
        </div>

        <div className="download__note">
          <span>首次安装需在系统设置中允许「安装未知来源应用」。</span>
          <span>APK 使用本机 Debug 签名，仅用于体验；正式发布签名另行配置。</span>
        </div>
      </div>
    </section>
  )
}
