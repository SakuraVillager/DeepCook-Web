import '@fontsource-variable/archivo/wght.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/noto-sans-sc/wght.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/online.css'
import './styles/canvas.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import OnlineEdition from './OnlineEdition'

createRoot(document.getElementById('root')!).render(
  <StrictMode><OnlineEdition /></StrictMode>,
)
