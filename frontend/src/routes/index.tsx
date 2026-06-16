import { Navigate, createBrowserRouter } from 'react-router-dom'

import App from '@/App'
import { ROUTES } from '@/constants/routes'
import Home from '@/pages/Home'
import Matches from '@/pages/Matches'
import { LegacyMatchDetailRedirect } from '@/routes/LegacyMatchDetailRedirect'

export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <App />,
    children: [
      {
        index: true,
        element: <Matches />,
      },
      {
        path: ROUTES.MATCH_DETAIL.slice(1),
        element: <Home />,
      },
      {
        path: 'phan-tich-du-doan',
        element: <LegacyMatchDetailRedirect />,
      },
      {
        path: 'du-doan',
        element: <LegacyMatchDetailRedirect />,
      },
      {
        path: 'matches',
        element: <Navigate to={ROUTES.HOME} replace />,
      },
      {
        path: '*',
        element: <Matches />,
      },
    ],
  },
])
