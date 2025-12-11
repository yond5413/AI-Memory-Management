'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { Header } from '@/app/components/Header';

const DEFAULT_EMBEDDING_MODEL = 'cohere/embed-english-v3.0';
const DEFAULT_LLM_MODEL = 'deepseek/deepseek-r1:free'; //  change later 

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [embeddingModel, setEmbeddingModel] = useState<string>(DEFAULT_EMBEDDING_MODEL);
  const [llmModel, setLlmModel] = useState<string>(DEFAULT_LLM_MODEL);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfileAndSettings() {
      setLoading(true);
      setError(null);
      setProfileMessage(null);
      setSettingsMessage(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
        setLoading(false);
        return;
      }

      if (!user) {
        router.push('/auth/login');
        return;
      }

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        setError(profileError.message);
      } else {
        setDisplayName(profile?.display_name ?? '');
      }

      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('embedding_model, llm_model')
        .eq('user_id', user.id)
        .single();

      if (!settingsError && settings) {
        setEmbeddingModel(settings.embedding_model ?? DEFAULT_EMBEDDING_MODEL);
        setLlmModel(settings.llm_model ?? DEFAULT_LLM_MODEL);
      } else {
        setEmbeddingModel(DEFAULT_EMBEDDING_MODEL);
        setLlmModel(DEFAULT_LLM_MODEL);
      }

      setLoading(false);
    }

    loadProfileAndSettings();
  }, [router, supabase]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSavingProfile(true);
    setProfileMessage(null);
    setError(null);

    const { error: saveError } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, display_name: displayName || null },
        { onConflict: 'id' }
      );

    if (saveError) {
      setError(saveError.message);
    } else {
      setProfileMessage('Display name updated.');
      setTimeout(() => setProfileMessage(null), 3000);
    }
    setSavingProfile(false);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSavingSettings(true);
    setSettingsMessage(null);
    setError(null);

    const { error: saveError } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: userId, embedding_model: embeddingModel, llm_model: llmModel },
        { onConflict: 'user_id' }
      );

    if (saveError) {
      setError(saveError.message);
    } else {
      setSettingsMessage('Model settings updated.');
      setTimeout(() => setSettingsMessage(null), 3000);
    }
    setSavingSettings(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex space-x-2">
          <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
          <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
          <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">Manage your account preferences and AI configuration.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
             <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Profile Card */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
              <p className="text-sm text-gray-500">Update your public profile details.</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">This name will be displayed in the chat interface.</p>
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-colors disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                  {profileMessage && (
                    <span className="text-sm text-green-600 animate-fade-in">
                      ✓ {profileMessage}
                    </span>
                  )}
                </div>
              </form>
            </div>
          </section>

          {/* AI Configuration Card */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">AI Configuration</h2>
              <p className="text-sm text-gray-500">Customize the underlying models for your memory system.</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Embedding Model</label>
                    <select
                      value={embeddingModel}
                      onChange={(e) => setEmbeddingModel(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    >
                      <option value="cohere/embed-english-v3.0">cohere/embed-english-v3.0</option>
                      <option value="openai/text-embedding-3-large">openai/text-embedding-3-large</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">LLM Model</label>
                    <select
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    >
                      <option value="deepseek/deepseek-r1:free">deepseek/deepseek-r1:free</option>
                      <option value="openai/gpt-oss-20b:free">openai/gpt-oss-20b</option>
                      <option value="qwen/qwen3-235b-a22b:free">qwen/qwen3-235b-a22b</option>
                      <option value="z-ai/glm-4.5-air:free">z-ai/glm-4.5-air</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 transition-colors disabled:opacity-50"
                  >
                    {savingSettings ? 'Updating...' : 'Update Configuration'}
                  </button>
                  {settingsMessage && (
                    <span className="text-sm text-green-600 animate-fade-in">
                      ✓ {settingsMessage}
                    </span>
                  )}
                </div>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
