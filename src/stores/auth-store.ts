import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import type { Profile } from '@/types/domain';
import { supabase } from '@/services/supabase';
import { signedAvatarUrl } from '@/services/drivers';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  initialized: boolean;
  initialize: () => Promise<() => void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null, profile: null, initialized: false,
  refreshProfile: async () => {
    const id = get().session?.user.id;
    if (!id) return set({ profile: null });
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (!error) set({ profile: { ...(data as Profile), avatar_url: await signedAvatarUrl(data.avatar_url) } });
  },
  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session });
    if (data.session) await get().refreshProfile();
    set({ initialized: true });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, profile: session ? get().profile : null });
      if (session) await get().refreshProfile();
    });
    return () => listener.subscription.unsubscribe();
  },
  signOut: async () => { await supabase.auth.signOut(); set({ session: null, profile: null }); },
}));
