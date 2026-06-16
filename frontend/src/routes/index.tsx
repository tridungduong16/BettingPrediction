import { createBrowserRouter } from 'react-router-dom'

import App from '@/App'
import { ROUTES } from '@/constants/routes'
import Home from '@/pages/Home'

export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: '*',
        element: <Home />,
      },
    ],
  },
])
