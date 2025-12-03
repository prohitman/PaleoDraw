import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode> {/* Using StrictMode to highlight potential problems in an application */}
    <App />
  </StrictMode>,
)
