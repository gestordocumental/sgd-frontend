import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createWorkflowSchema,
  approveSchema,
  rejectSchema,
  type CreateWorkflowForm,
  type ApproveForm,
  type RejectForm,
} from './workflow-schemas';

export function useWorkflowForms() {
  const createForm = useForm<CreateWorkflowForm>({
    resolver: zodResolver(createWorkflowSchema),
    mode: 'onChange',
    defaultValues: { title: '', description: '' },
  });

  const approveForm = useForm<ApproveForm>({
    resolver: zodResolver(approveSchema),
    mode: 'onChange',
  });

  const rejectForm = useForm<RejectForm>({
    resolver: zodResolver(rejectSchema),
    mode: 'onChange',
  });

  const editForm = useForm<CreateWorkflowForm>({
    resolver: zodResolver(createWorkflowSchema),
    mode: 'onChange',
  });

  return { createForm, approveForm, rejectForm, editForm };
}
