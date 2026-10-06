import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { useStore } from './store/store'
import { GridSkeleton } from './components/ui'
import Home from './pages/Home'
import { ErrorBoundary } from './components/ErrorBoundary'

const Food = lazy(() => import('./pages/Food'))
const RestaurantPage = lazy(() => import('./pages/RestaurantPage'))
const Shop = lazy(() => import('./pages/Shop'))
const ProductPage = lazy(() => import('./pages/ProductPage'))
const StorePage = lazy(() => import('./pages/StorePage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const Offers = lazy(() => import('./pages/Offers'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const OrderPage = lazy(() => import('./pages/OrderPage'))
const Orders = lazy(() => import('./pages/Orders'))
const Favorites = lazy(() => import('./pages/Favorites'))
const Account = lazy(() => import('./pages/Account'))
const AccountPages = lazy(() => import('./pages/AccountPages'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Help = lazy(() => import('./pages/Help'))
const SupportChat = lazy(() => import('./pages/SupportChat'))
const Login = lazy(() => import('./pages/Login'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Admin = lazy(() => import('./pages/admin/Admin'))

function RequireAuth({ children }: { children: ReactNode }) {
  const uid = useStore((s) => s.currentUserId)
  const loc = useLocation()
  if (!uid) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <>{children}</>
}

const Fallback = () => (
  <div className="mx-auto max-w-7xl px-4 py-8">
    <GridSkeleton count={6} />
  </div>
)

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="food" element={<Food />} />
              <Route path="restaurant/:id" element={<RestaurantPage />} />
              <Route path="shop" element={<Shop />} />
              <Route path="product/:id" element={<ProductPage />} />
              <Route path="store/:id" element={<StorePage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="offers" element={<Offers />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
              <Route path="orders" element={<RequireAuth><Orders /></RequireAuth>} />
              <Route path="orders/:id" element={<RequireAuth><OrderPage /></RequireAuth>} />
              <Route path="favorites" element={<Favorites />} />
              <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
              <Route path="account/:section" element={<RequireAuth><AccountPages /></RequireAuth>} />
              <Route path="notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
              <Route path="help" element={<Help />} />
              <Route path="help/chat" element={<SupportChat />} />
              <Route path="login" element={<Login />} />
              <Route path="admin/*" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  )
}
