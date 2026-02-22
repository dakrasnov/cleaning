import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#0F2041',
            color: '#fff',
            borderRadius: '12px',
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 500,
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#00C9A7', secondary: '#fff' } },
          error: { iconTheme: { primary: '#E53E3E', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
