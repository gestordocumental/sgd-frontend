import type { Meta, StoryObj } from '@storybook/react';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from './sheet';
import { Button } from './button';

const meta: Meta = {
  title: 'UI/Sheet',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj;

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open right sheet</Button>} />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Sheet title</SheetTitle>
          <SheetDescription>Sheet description / subtitle goes here.</SheetDescription>
        </SheetHeader>
        <div className="px-4 flex-1">
          <p className="text-sm text-muted-foreground">Sheet body content.</p>
        </div>
        <SheetFooter>
          <SheetClose render={<Button variant="outline">Close</Button>} />
          <Button>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Left: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open left sheet</Button>} />
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Left sheet</SheetTitle>
        </SheetHeader>
        <div className="px-4 flex-1">
          <p className="text-sm text-muted-foreground">Opens from the left side.</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const Bottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open bottom sheet</Button>} />
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Bottom sheet</SheetTitle>
        </SheetHeader>
        <div className="px-4">
          <p className="text-sm text-muted-foreground">Opens from the bottom.</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};
