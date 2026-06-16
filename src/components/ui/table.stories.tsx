import type { Meta, StoryObj } from '@storybook/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';
import { Badge } from './badge';

const meta: Meta<typeof Table> = {
  title: 'UI/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof Table>;

const users = [
  { id: '001', name: 'Ana García', email: 'ana@helisa.com', role: 'Admin', status: 'Active' },
  { id: '002', name: 'Carlos López', email: 'carlos@helisa.com', role: 'Editor', status: 'Active' },
  {
    id: '003',
    name: 'María Torres',
    email: 'maria@helisa.com',
    role: 'Viewer',
    status: 'Inactive',
  },
];

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>User list</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-medium">{u.name}</TableCell>
            <TableCell className="text-muted-foreground">{u.email}</TableCell>
            <TableCell>{u.role}</TableCell>
            <TableCell>
              <Badge variant={u.status === 'Active' ? 'default' : 'secondary'}>{u.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const Empty: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={2} className="text-center text-muted-foreground py-10">
            No results found.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
