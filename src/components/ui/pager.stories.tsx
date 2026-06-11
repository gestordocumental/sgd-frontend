import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Pager } from './pager';

const meta: Meta<typeof Pager> = {
  title: 'UI/Pager',
  component: Pager,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof Pager>;

export const PageNumbers: Story = {
  render: function Render() {
    const [page, setPage] = useState(3);
    return (
      <div className="w-64">
        <Pager page={page} totalPages={10} onChange={setPage} total={98} />
      </div>
    );
  },
};

export const FirstPage: Story = {
  render: () => (
    <div className="w-48">
      <Pager page={1} totalPages={5} onChange={() => {}} />
    </div>
  ),
};

export const LastPage: Story = {
  render: () => (
    <div className="w-48">
      <Pager page={5} totalPages={5} onChange={() => {}} />
    </div>
  ),
};

export const PrevNext: Story = {
  render: function Render() {
    const [page, setPage] = useState(2);
    return (
      <div className="w-32">
        <Pager
          hasPrev={page > 1}
          hasNext={page < 5}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      </div>
    );
  },
};
