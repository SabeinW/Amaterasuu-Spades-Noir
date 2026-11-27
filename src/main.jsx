import './lib/diag'
import './lib/lite'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CrashGuard from './components/ui/CrashGuard'
import PhoneCheck from './components/ui/PhoneCheck'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CrashGuard>
      <App />
      <PhoneCheck />
    </CrashGuard>
  </StrictMode>,
)
