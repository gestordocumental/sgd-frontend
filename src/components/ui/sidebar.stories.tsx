import type { Meta, StoryObj } from '@storybook/react';
import { HomeIcon, UsersIcon, FileTextIcon, SettingsIcon, BuildingIcon } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from './sidebar';
import { Avatar, AvatarFallback } from './avatar';

const meta: Meta = {
  title: 'UI/Sidebar',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

const navItems = [
  { icon: HomeIcon, label: 'Dashboard', url: '#' },
  { icon: UsersIcon, label: 'Users', url: '#' },
  { icon: FileTextIcon, label: 'Documents', url: '#' },
  { icon: BuildingIcon, label: 'Companies', url: '#' },
  { icon: SettingsIcon, label: 'Settings', url: '#' },
];

export const Default: Story = {
  render: () => (
    <SidebarProvider className="h-screen">
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-2">
          <div className="flex items-center gap-2 px-2">
            <Avatar size="sm">
              <AvatarFallback>SG</AvatarFallback>
            </Avatar>
            <span className="font-semibold text-sm truncate">SGD Helisa</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton tooltip={item.label}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-2">
          <div className="flex items-center gap-2 px-2">
            <Avatar size="sm">
              <AvatarFallback>JC</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">juan@helisa.com</span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium">Dashboard</span>
        </header>
        <main className="p-4">
          <p className="text-sm text-muted-foreground">Main content area.</p>
        </main>
      </SidebarInset>
    </SidebarProvider>
  ),
};

export const Expanded: Story = {
  render: () => (
    <SidebarProvider defaultOpen className="h-screen">
      <Sidebar collapsible="none">
        <SidebarHeader className="p-2">
          <div className="flex items-center gap-2 px-2">
            <Avatar size="sm">
              <AvatarFallback>SG</AvatarFallback>
            </Avatar>
            <span className="font-semibold text-sm">SGD Helisa</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <main className="p-4">
          <p className="text-sm text-muted-foreground">Non-collapsible sidebar.</p>
        </main>
      </SidebarInset>
    </SidebarProvider>
  ),
};
