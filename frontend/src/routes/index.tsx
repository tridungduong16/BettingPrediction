import { Navigate, createBrowserRouter } from 'react-router-dom'

import App from '@/App'
import { ROUTES } from '@/constants/routes'
import Home from '@/pages/Home'
import Matches from '@/pages/Matches'

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
        path: ROUTES.PREDICTION_ANALYSIS.slice(1),
        element: <Home />,
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
