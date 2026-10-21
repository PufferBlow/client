import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authed } from "../../services/authed";
import { channelKeys } from "./hooks";
import type { Channel } from "./types";

const CHANNELS = "/api/v1/channels";

/** A named group of channels, instance-wide. Channels point at one with `category_id`. */
export interface Category {
  category_id: string;
  name: string;
  position: number;
}

export const categoryKeys = { list: ["channels", "categories"] as const };

export async function listCategories(): Promise<Category[]> {
  const { categories } = await authed.query<{ categories?: Category[] }>("GET", `${CHANNELS}/categories`);
  return categories ?? [];
}

export function useCategories() {
  return useQuery({ queryKey: categoryKeys.list, queryFn: listCategories, staleTime: 60_000 });
}

/** The category admin: add, rename, delete and reorder. Each keeps both cached lists in step. */
export function useCategoryAdmin() {
  const queryClient = useQueryClient();
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: categoryKeys.list }), queryClient.invalidateQueries({ queryKey: channelKeys.list })]);

  const create = useMutation({
    mutationFn: async (name: string) => (await authed.body<{ category: Category }>("POST", `${CHANNELS}/categories`, { name })).category,
    onSuccess: refresh,
  });
  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      (await authed.body<{ category: Category }>("PUT", `${CHANNELS}/categories/${encodeURIComponent(id)}`, { name })).category,
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => authed.query("DELETE", `${CHANNELS}/categories/${encodeURIComponent(id)}`),
    onSuccess: refresh,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => authed.body("PUT", `${CHANNELS}/categories/order`, { category_ids: ids }),
    // Move them on screen at once; the refresh below settles it with what the server decided.
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.list });
      const previous = queryClient.getQueryData<Category[]>(categoryKeys.list);
      queryClient.setQueryData<Category[]>(categoryKeys.list, (list) => {
        if (!list) return list;
        const byId = new Map(list.map((c) => [c.category_id, c]));
        const named = ids.flatMap((id) => byId.get(id) ?? []);
        const rest = list.filter((c) => !ids.includes(c.category_id));
        return [...named, ...rest].map((c, position) => ({ ...c, position }));
      });
      return { previous };
    },
    onError: (_error, _ids, context) => queryClient.setQueryData(categoryKeys.list, context?.previous),
    onSettled: refresh,
  });
  return { create, rename, remove, reorder };
}

/** One group in the channel list: a category (or none) and its channels, in order. */
export interface ChannelGroup {
  /** Null for channels that sit in no category. */
  category: Category | null;
  channels: Channel[];
}

const byPlace = (a: Channel, b: Channel) => (a.position ?? 0) - (b.position ?? 0) || a.channel_name.localeCompare(b.channel_name);

/**
 * Channels grouped for the sidebar: categories in their order, each holding its channels by
 * position then name; channels in no category (or in one that no longer exists) come last.
 * A category with no channels is left out: it would only be a heading over nothing.
 */
export function groupChannels(channels: readonly Channel[], categories: readonly Category[]): ChannelGroup[] {
  const known = new Set(categories.map((c) => c.category_id));
  const groups: ChannelGroup[] = [...categories]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((category) => ({ category, channels: channels.filter((c) => c.category_id === category.category_id).sort(byPlace) }))
    .filter((group) => group.channels.length > 0);
  const loose = channels.filter((c) => !c.category_id || !known.has(c.category_id)).sort(byPlace);
  if (loose.length > 0) groups.push({ category: null, channels: loose });
  return groups;
}
