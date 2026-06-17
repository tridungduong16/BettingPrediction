import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'

import { I18nProvider } from '@/i18n/I18nProvider'
import { router } from '@/routes'
import { store } from '@/store'
import '@/styles/main.scss'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </I18nProvider>
  </StrictMode>,
)
