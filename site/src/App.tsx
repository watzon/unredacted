import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { BrowsePage } from './pages/BrowsePage'
import { DocumentPage } from './pages/DocumentPage'
import { Layout } from './components/Layout'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'browse', element: <BrowsePage /> },
      { path: 'document/:id', element: <DocumentPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
