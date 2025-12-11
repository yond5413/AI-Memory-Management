"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/AuthProvider";
import { createClient } from "@/app/lib/supabase/client";
import { Header } from "@/app/components/Header";
import { Memory } from "@/app/lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  response: string;
  retrievedMemories: Memory[];
}

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful AI assistant with access to a long-term memory system. Use the provided context to answer the user's questions accurately.");
  const [retrievedMemories, setRetrievedMemories] = useState<Memory[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    setRetrievedMemories([]); // Clear previous debug info

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: userMessage,
          memoryEnabled,
          systemPrompt,
          history: messages.slice(-5) // Send last 5 messages for context window
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data: ChatResponse = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      setRetrievedMemories(data.retrievedMemories);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error processing your request." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to get auth token - in a real app use the supabase client
  const getAuthToken = () => {
     // Unused now
     return ""; 
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-64px)]">
        {/* Chat Area */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm flex flex-col h-full border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">Chat Session</h2>
            <div className="flex items-center space-x-2">
               <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></span>
               <span className="text-xs text-gray-500">{isLoading ? 'Thinking...' : 'Ready'}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-10">
                <p>Start a conversation to test memory retrieval.</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        {/* Settings & Debug Panel */}
        <div className="flex flex-col space-y-6 h-full overflow-y-auto">
          {/* Settings */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-4">Configuration</h3>
            
            <div className="mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={memoryEnabled}
                  onChange={(e) => setMemoryEnabled(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable Memory Retrieval</span>
              </label>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
              />
            </div>
          </div>

          {/* Retrieved Memories (Debug) */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex-1 overflow-y-auto">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center justify-between">
              <span>Context (Debug)</span>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                {retrievedMemories.length} retrieved
              </span>
            </h3>
            
            {retrievedMemories.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No memories retrieved for the last message.</p>
            ) : (
              <div className="space-y-3">
                {retrievedMemories.map((mem) => (
                  <div key={mem.id} className="p-3 bg-blue-50 rounded border border-blue-100 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-blue-800 text-xs uppercase">{mem.status}</span>
                      <span className="text-xs text-blue-600">{new Date(mem.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-800">{mem.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

