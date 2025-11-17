'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';

const DEFAULT_EMBEDDING_MODEL = 'cohere/embed-english-v3.0';
const DEFAULT_LLM_MODEL = 'anthropic/claude-3.5-sonnet';

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

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

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

      // Load profile display name
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

      // Load user settings (embedding / LLM models)
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('embedding_model, llm_model')
        .eq('user_id', user.id)
        .single();

      if (!settingsError && settings) {
        setEmbeddingModel(settings.embedding_model ?? DEFAULT_EMBEDDING_MODEL);
        setLlmModel(settings.llm_model ?? DEFAULT_LLM_MODEL);
      } else {
        // If no row yet, fall back to defaults without treating as error
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
        {
          id: userId,
          display_name: displayName || null,
        },
        { onConflict: 'id' }
      );

    if (saveError) {
      setError(saveError.message);
    } else {
      setProfileMessage('Display name updated.');
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
        {
          user_id: userId,
          embedding_model: embeddingModel,
          llm_model: llmModel,
        },
        { onConflict: 'user_id' }
      );

    if (saveError) {
      setError(saveError.message);
    } else {
      setSettingsMessage('Model settings updated.');
    }

    setSavingSettings(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-2xl w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Account settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your profile and AI configuration.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
          >
            Back to main
          </button>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Profile section */}
        <form onSubmit={handleSaveProfile} className="space-y-4 border-t pt-6">
          <div>
            <h2 className="text-sm font-medium text-gray-700">Display name</h2>
            <p className="mt-1 text-sm text-gray-500">
              This is how your name will appear in the app.
            </p>
            <input
              type="text"
              className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading || savingProfile}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Leave blank to clear your display name.
            </span>
            <button
              type="submit"
              disabled={loading || savingProfile}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {savingProfile ? 'Saving...' : 'Save'}
            </button>
          </div>
          {profileMessage && (
            <p className="text-xs text-green-700">{profileMessage}</p>
          )}
        </form>

        {/* User settings section */}
        <form onSubmit={handleSaveSettings} className="space-y-4 border-t pt-6">
          <div>
            <h2 className="text-sm font-medium text-gray-700">AI models</h2>
            <p className="mt-1 text-sm text-gray-500">
              Choose which embedding and LLM models this workspace should use.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Embedding model
              </label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                disabled={loading || savingSettings}
              >
                <option value="cohere/embed-english-v3.0">
                  cohere/embed-english-v3.0
                </option>
                <option value="openai/text-embedding-3-large">
                  openai/text-embedding-3-large
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                LLM model
              </label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                disabled={loading || savingSettings}
              >
                <option value="anthropic/claude-3.5-sonnet">
                  anthropic/claude-3.5-sonnet
                </option>
                <option value="openai/gpt-4.1-mini">openai/gpt-4.1-mini</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={loading || savingSettings}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save model settings'}
            </button>
          </div>

          {settingsMessage && (
            <p className="text-xs text-green-700">{settingsMessage}</p>
          )}
        </form>
      </div>
    </div>
  );
}


