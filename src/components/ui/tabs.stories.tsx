import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-80">
      <TabsList variant="default">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-sm text-muted-foreground p-2">Overview content.</p>
      </TabsContent>
      <TabsContent value="users">
        <p className="text-sm text-muted-foreground p-2">Users content.</p>
      </TabsContent>
      <TabsContent value="settings">
        <p className="text-sm text-muted-foreground p-2">Settings content.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-80">
      <TabsList variant="line">
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <p className="text-sm text-muted-foreground p-2">First tab.</p>
      </TabsContent>
      <TabsContent value="tab2">
        <p className="text-sm text-muted-foreground p-2">Second tab.</p>
      </TabsContent>
      <TabsContent value="tab3">
        <p className="text-sm text-muted-foreground p-2">Third tab.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-72">
      <TabsList>
        <TabsTrigger value="tab1">Active</TabsTrigger>
        <TabsTrigger value="tab2" disabled>
          Disabled
        </TabsTrigger>
        <TabsTrigger value="tab3">Other</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <p className="text-sm text-muted-foreground p-2">Active tab.</p>
      </TabsContent>
    </Tabs>
  ),
};
