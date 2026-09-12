import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/caveat/400.css'
import '@fontsource/dancing-script/400.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/dm-serif-display/400.css'
import '@fontsource/libre-baskerville/400.css'
import '@fontsource/quicksand/400.css'
import '@fontsource/satisfy/400.css'
import '@fontsource/space-grotesk/400.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
