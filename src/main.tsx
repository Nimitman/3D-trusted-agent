import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useFilm } from './state/store'
import { detectTier } from './quality/detectTier'
import App from './App'
import './styles/tokens.css'
import './styles/app.css'

// Decide reduced motion and the quality tier before anything renders.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const tier = detectTier(reducedMotion)
useFilm.setState({ reducedMotion, tier, ready: tier === 'flat' })

history.scrollRestoration = 'manual'
scrollTo(0, 0)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
