import type { Meta, StoryObj } from '@storybook/react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';

const meta: Meta = {
  title: 'UI/Dialog',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogDescription>
            This is a description for the dialog. Provide context here.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Dialog body content goes here.</p>
        <DialogFooter showCloseButton>
          <Button size="sm">Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithoutCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open (no close btn)</Button>} />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>No close button</DialogTitle>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button size="sm">OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
