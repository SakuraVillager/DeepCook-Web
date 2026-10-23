import '@fontsource-variable/archivo/wght.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/noto-sans-sc/wght.css'
import 'lenis/dist/lenis.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/sections.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
