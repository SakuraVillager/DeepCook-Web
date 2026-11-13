import { appDownload } from '../data/app-download'
import { ChapterLabel } from './ChapterLabel'
import { DesignCanvas } from './DesignCanvas'

export function Download() {
  return (
    <section className="section chapter canvas-page download" id="download" data-theme="light">
      <DesignCanvas className="container chapter__canvas" label="下载画布">
        <ChapterLabel index="06" title="GET IT" heat="上桌 · SERVE" />
        <div className="download__head">
          <div>
            <h2 className="download__title" data-reveal>
              把厨房，
              <br />
              <span className="serif">装进口袋。</span>
            </h2>
          </div>
          <p className="body-lg download__description" data-reveal>
            装进手机，或者直接在浏览器里打开。
            两种方式，同一间厨房。
          </p>
        </div>

        <div className="download__grid">
          <a
            className="download-card download-card--apk"
            href="./android/"
            data-reveal
          >
            <div className="download-card__top">
              <span className="download-card__num">01 / ON YOUR PHONE</span>
              <span className="download-card__num">APK</span>
            </div>
            <div>
              <h3>下载 Android 版</h3>
              <p>
                494 道菜谱随包提供，登录后可离线翻阅。
                账号资料与互动联网同步。
              </p>
              <span className="btn btn--ghost">
                了解 APP / 下载
                <span className="arrow" aria-hidden="true" />
              </span>
            </div>
            <div className="download-card__bottom">
              <div className="download-card__meta">
                VERSION {appDownload.version} · {appDownload.sizeLabel}
                <br />
                ANDROID 8.0+ · RELEASE
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
                494 道菜谱，打开浏览器就能翻阅、搜索和分步阅读。
                收藏好菜，也写下自己的拿手菜。
              </p>
              <span className="btn btn--ghost">
                在线使用
                <span className="arrow" aria-hidden="true" />
              </span>
            </div>
            <div className="download-card__bottom">
              <div className="download-card__meta">
                ONLINE · BETA
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
          <span>旧调试版请先同步资料，卸载后再安装正式版。</span>
        </div>
      </DesignCanvas>
    </section>
  )
}
