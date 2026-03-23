import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, FormInput } from '../../shared/ui';
import { useLoginMutation } from './api/use-login-mutation';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Form } from '../../shared/ui/form/form';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginForm = () => {
  const navigate = useNavigate();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { mutateAsync } = useLoginMutation({
    onSuccess: () => navigate({ to: '/', replace: true }),
  });

  const onSubmit = async (data: LoginFormValues) => {
    await toast.promise(mutateAsync(data), {
      loading: 'Authenticating...',
      success: 'Welcome back!',
    });
  };

  return (
    <Form form={form} onSubmit={onSubmit} className="flex flex-col gap-y-5">
      <FormInput<LoginFormValues>
        name="email"
        label="Email Address"
        type="email"
        placeholder="marcus@aurelius.com"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="email"
        spellCheck="false"
      />

      {/* TODO: add forgot password implementation */}
      <FormInput<LoginFormValues>
        name="password"
        label="Password"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        rightLabelSlot={
          <Link
            to="/"
            className="text-secondary text-xs font-semibold hover:underline"
            tabIndex={-1}
          >
            Forgot password?
          </Link>
        }
      />

      <Button type="submit">
        {form.formState.isSubmitting ? 'Signing In...' : 'Sign In'}
      </Button>
    </Form>
  );
};
