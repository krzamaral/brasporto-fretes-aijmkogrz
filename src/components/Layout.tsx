import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { LayoutDashboard, History as HistoryIcon, LogOut, Menu } from 'lucide-react'
import logoUrl from '@/assets/logo-color-ad1d0.png'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const MENU_ITEMS = [
  { title: 'Dashboard', icon: LayoutDashboard, url: '/dashboard' },
  { title: 'Histórico', icon: HistoryIcon, url: '/history' },
]

export default function Layout() {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b bg-white px-4 shadow-sm md:px-6">
        <div className="flex items-center gap-6">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-16 items-center border-b px-4">
                <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                  <img src={logoUrl} alt="Brasporto" className="h-8 object-contain" />
                </Link>
              </div>
              <div className="flex flex-col gap-1 p-4">
                {MENU_ITEMS.map((item) => {
                  const isActive = location.pathname === item.url
                  return (
                    <Link
                      key={item.title}
                      to={item.url}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.title}
                    </Link>
                  )
                })}
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="hidden items-center gap-2 md:flex">
            <img src={logoUrl} alt="Brasporto" className="h-8 object-contain" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex ml-6">
            {MENU_ITEMS.map((item) => {
              const isActive = location.pathname === item.url
              return (
                <Link
                  key={item.title}
                  to={item.url}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full outline-none hover:opacity-80 transition-opacity">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage
                    src="https://img.usecurling.com/ppl/thumbnail?gender=male&seed=1"
                    alt="User profile"
                  />
                  <AvatarFallback>
                    {user?.name ? user.name.substring(0, 2).toUpperCase() : 'UN'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col items-start text-sm md:flex">
                  <span className="font-medium leading-none text-foreground">
                    {user?.name || user?.email?.split('@')[0] || 'Usuário'}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex flex-col space-y-1 p-2 md:hidden">
                <p className="text-sm font-medium leading-none">
                  {user?.name || user?.email?.split('@')[0] || 'Usuário'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer mt-1 md:mt-0"
              >
                <div className="w-full flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  <span>Sair da conta</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8 animate-fade-in">
        <div className="mx-auto max-w-7xl w-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
