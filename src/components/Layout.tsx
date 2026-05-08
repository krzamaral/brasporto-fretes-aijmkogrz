import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, UploadCloud, ClipboardCheck, Trophy, LogOut, Truck } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const MENU_ITEMS = [
  { title: 'Dashboard', icon: LayoutDashboard, url: '/dashboard' },
  { title: 'Upload', icon: UploadCloud, url: '/upload' },
  { title: 'Conferência', icon: ClipboardCheck, url: '/review' },
  { title: 'Ranking', icon: Trophy, url: '/ranking' },
]

export default function Layout() {
  const location = useLocation()

  const currentRouteName =
    MENU_ITEMS.find((item) => item.url === location.pathname)?.title || 'Brasporto'

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2 px-2 text-sidebar-primary-foreground">
              <Truck className="h-6 w-6" />
              <span className="text-xl font-bold tracking-tight">Brasporto</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {MENU_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === item.url}
                        className="py-5"
                      >
                        <Link to={item.url}>
                          <item.icon className="h-5 w-5" />
                          <span className="text-base">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-md p-2 hover:bg-sidebar-accent transition-colors outline-none">
                  <Avatar className="h-9 w-9 border border-sidebar-border">
                    <AvatarImage
                      src="https://img.usecurling.com/ppl/thumbnail?gender=male&seed=1"
                      alt="User profile"
                    />
                    <AvatarFallback>UN</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm text-sidebar-foreground">
                    <span className="font-medium">João Silva</span>
                    <span className="text-xs opacity-70">joao.silva@brasporto.com</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  asChild
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                >
                  <Link to="/login" className="w-full flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    <span>Sair da conta</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col w-full overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-card px-4 md:px-6 shadow-sm z-10">
            <SidebarTrigger className="-ml-2 md:hidden" />
            <div className="flex flex-1 items-center justify-between">
              <h1 className="text-lg font-semibold text-foreground hidden md:block">
                {currentRouteName}
              </h1>
              <div className="flex items-center gap-4 ml-auto"></div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-8 animate-fade-in">
            <div className="mx-auto max-w-5xl w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
