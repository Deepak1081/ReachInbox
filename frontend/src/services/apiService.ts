import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api.js';
import {
  EmailStats,
  PaginatedResult,
  ScheduledEmailItem,
  Sender,
  SlackStatus,
  ScheduleEmailPayload,
} from '../types/index.js';

export const emailKeys = {
  all: ['emails'] as const,
  stats: () => [...emailKeys.all, 'stats'] as const,
  scheduled: (page: number, limit: number, status?: string) =>
    [...emailKeys.all, 'scheduled', { page, limit, status }] as const,
  sent: (page: number, limit: number, status?: string) =>
    [...emailKeys.all, 'sent', { page, limit, status }] as const,
  search: (query: string, status?: string) =>
    [...emailKeys.all, 'search', { query, status }] as const,
  senders: () => ['senders'] as const,
  slackStatus: () => ['slack', 'status'] as const,
};

// 1. Fetch Email Statistics
export function useEmailStats() {
  return useQuery({
    queryKey: emailKeys.stats(),
    queryFn: async (): Promise<EmailStats> => {
      const res = await api.get('/emails/stats');
      return res.data.data;
    },
    refetchInterval: 5000, // Poll every 5s for live job counter updates
  });
}

// 2. Fetch Scheduled Emails
export function useScheduledEmails(page: number = 1, limit: number = 15, status?: string) {
  return useQuery({
    queryKey: emailKeys.scheduled(page, limit, status),
    queryFn: async (): Promise<PaginatedResult<ScheduledEmailItem>> => {
      const res = await api.get('/emails/scheduled', {
        params: { page, limit, status },
      });
      return res.data.data;
    },
    refetchInterval: 5000,
  });
}

// 3. Fetch Sent / Failed Emails
export function useSentEmails(page: number = 1, limit: number = 15, status?: string) {
  return useQuery({
    queryKey: emailKeys.sent(page, limit, status),
    queryFn: async (): Promise<PaginatedResult<ScheduledEmailItem>> => {
      const res = await api.get('/emails/sent', {
        params: { page, limit, status },
      });
      return res.data.data;
    },
    refetchInterval: 5000,
  });
}

// 4. Search Emails
export function useSearchEmails(query: string, status?: string) {
  return useQuery({
    queryKey: emailKeys.search(query, status),
    queryFn: async (): Promise<PaginatedResult<ScheduledEmailItem>> => {
      const res = await api.get('/emails/search', {
        params: { q: query, status },
      });
      return res.data.data;
    },
    enabled: query.trim().length > 0,
  });
}

// 5. Fetch Senders
export function useSenders() {
  return useQuery({
    queryKey: emailKeys.senders(),
    queryFn: async (): Promise<Sender[]> => {
      const res = await api.get('/senders');
      return res.data.data;
    },
  });
}

// 6. Fetch Slack Connection Status
export function useSlackStatus() {
  return useQuery({
    queryKey: emailKeys.slackStatus(),
    queryFn: async (): Promise<SlackStatus> => {
      const res = await api.get('/slack/status');
      return res.data.data;
    },
  });
}

// 7. Schedule Emails Mutation
export function useScheduleEmails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ScheduleEmailPayload) => {
      const res = await api.post('/emails/schedule', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.all });
    },
  });
}

// 8. Create Sender Mutation
export function useCreateSender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; displayName: string; isDefault?: boolean }) => {
      const res = await api.post('/senders', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.senders() });
    },
  });
}

// 9. Delete Sender Mutation
export function useDeleteSender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/senders/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.senders() });
    },
  });
}

// 10. Disconnect Slack Mutation
export function useDisconnectSlack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post('/slack/disconnect');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.slackStatus() });
    },
  });
}
