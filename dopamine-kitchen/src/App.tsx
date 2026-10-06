import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { useStore } from './store/store'
import { GridSkeleton } from './components/ui'
import Home from './pages/Home'
import { ErrorBoundary } from './components/ErrorBoundary'

// Route code is split per page, then preloaded while the browser is idle so navigation feels instant.
const loaders = {
  Food: () => import('./pages/Food'),
  RestaurantPage: () => import('./pages/RestaurantPage'),
  Shop: () => import('./pages/Shop'),
  ProductPage: () => import('./pages/ProductPage'),
  StorePage: () => import('./pages/StorePage'),
  SearchPage: () => import('./pages/SearchPage'),
  Offers: () => import('./pages/Offers'),
  Cart: () => import('./pages/Cart'),
  Checkout: () => import('./pages/Checkout'),
  OrderPage: () => import('./pages/OrderPage'),
  Orders: () => import('./pages/Orders'),
  Favorites: () => import('./pages/Favorites'),
  Account: () => import('./pages/Account'),
  AccountPages: () => import('./pages/AccountPages'),
  Notifications: () => import('./pages/Notifications'),
  Help: () => import('./pages/Help'),
  SupportChat: () => import('./pages/SupportChat'),
  Login: () => import('./pages/Login'),
  NotFound: () => import('./pages/NotFound'),
  Admin: () => import('./pages/admin/Admin'),
}

function usePreloadRoutes() {
  useEffect(() => {
    const run = () => Object.values(loaders).forEach((load) => load().catch(() => undefined))
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(run)
    else setTimeout(run, 1200)
  }, [])
}

const Food = lazy(loaders.Food)
const RestaurantPage = lazy(loaders.RestaurantPage)
const Shop = lazy(loaders.Shop)
const ProductPage = lazy(loaders.ProductPage)
const StorePage = lazy(loaders.StorePage)
const SearchPage = lazy(loaders.SearchPage)
const Offers = lazy(loaders.Offers)
const Cart = lazy(loaders.Cart)
const Checkout = lazy(loaders.Checkout)
const OrderPage = lazy(loaders.OrderPage)
const Orders = lazy(loaders.Orders)
const Favorites = lazy(loaders.Favorites)
const Account = lazy(loaders.Account)
const AccountPages = lazy(loaders.AccountPages)
const Notifications = lazy(loaders.Notifications)
const Help = lazy(loaders.Help)
const SupportChat = lazy(loaders.SupportChat)
const Login = lazy(loaders.Login)
const NotFound = lazy(loaders.NotFound)
const Admin = lazy(loaders.Admin)

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
  usePreloadRoutes()
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
