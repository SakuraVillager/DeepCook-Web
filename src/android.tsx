import '@fontsource-variable/archivo/wght.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/noto-sans-sc/wght.css'
import 'lenis/dist/lenis.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/header.css'
import './styles/footer.css'
import './styles/cursor.css'
import './styles/android.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AndroidIntro } from './AndroidIntro'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AndroidIntro />
  </StrictMode>,
)
