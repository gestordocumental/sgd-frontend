import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'UI/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline">Hover me</Button>} />
      <TooltipContent>Tooltip content</TooltipContent>
    </Tooltip>
  ),
};

export const Sides: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-8 place-items-center p-16">
      <div />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="outline" size="sm">
              Top
            </Button>
          }
        />
        <TooltipContent side="top">Top tooltip</TooltipContent>
      </Tooltip>
      <div />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="outline" size="sm">
              Left
            </Button>
          }
        />
        <TooltipContent side="left">Left tooltip</TooltipContent>
      </Tooltip>
      <div />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="outline" size="sm">
              Right
            </Button>
          }
        />
        <TooltipContent side="right">Right tooltip</TooltipContent>
      </Tooltip>
      <div />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="outline" size="sm">
              Bottom
            </Button>
          }
        />
        <TooltipContent side="bottom">Bottom tooltip</TooltipContent>
      </Tooltip>
      <div />
    </div>
  ),
};
