'use client';
import { useState } from 'react';
import { api } from './ui';
import { learningAgents, type AgentMemory, type LearningAgent } from '@/lib/agent-learning';
export default function AgentMemorySettings() {
  const [agents, setAgents] = useState<Partial<Record<LearningAgent, AgentMemory>>>();
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function refresh() {
    setBusy(true);
    setMessage('');
    try {
      const result = await api<{
        agents: Record<LearningAgent, AgentMemory>;
        garmentNames?: Record<string, string>;
      }>('/api/agent-memory');
      setAgents(result.agents);
      setNames(result.garmentNames ?? {});
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reset(agent?: LearningAgent) {
    setBusy(true);
    setMessage('');
    try {
      await api('/api/agent-memory', 'DELETE', agent ? { agent } : {});
      const result = await api<{
        agents: Record<LearningAgent, AgentMemory>;
        garmentNames?: Record<string, string>;
      }>('/api/agent-memory');
      setAgents(result.agents);
      setNames(result.garmentNames ?? {});
      setMessage('Learned preferences reset. Saved photos, outfits and ratings are unchanged.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>What your agents remember</summary>
      <div className="stack">
        <p>
          Only feedback you choose to remember guides future suggestions. No shared model training
          or automatic paid generations.
        </p>
        <button disabled={busy} onClick={refresh}>
          Review learned preferences
        </button>
        {agents &&
          learningAgents.map((agent) => (
            <section key={agent}>
              <h4>
                {agent === 'detect'
                  ? 'Capture'
                  : agent === 'shop'
                    ? 'Shopping'
                    : agent[0].toUpperCase() + agent.slice(1)}
              </h4>
              <p>{agents[agent]?.feedbackCount ?? 0} remembered ratings</p>
              {agents[agent]?.rules.map((rule) => (
                <p key={rule}>{rule}</p>
              ))}
              {!!agents[agent]?.avoidCombinations.length && (
                <p>{agents[agent]?.avoidCombinations.length} rejected outfit combinations</p>
              )}
              {agents[agent]?.avoidCombinations.map((ids, index) => (
                <small key={'avoid' + index}>
                  Avoid repeating: {ids.map((id) => names[id] ?? 'Removed piece').join(' + ')}
                </small>
              ))}
              {agents[agent]?.preferredCombinations.map((ids, index) => (
                <small key={'prefer' + index}>
                  Previously helpful: {ids.map((id) => names[id] ?? 'Removed piece').join(' + ')}
                </small>
              ))}
              <button disabled={busy || !agents[agent]?.feedbackCount} onClick={() => reset(agent)}>
                Reset {agent === 'detect' ? 'Capture' : agent} preferences
              </button>
            </section>
          ))}
        {agents && (
          <button disabled={busy} onClick={() => reset()}>
            Reset all learned preferences
          </button>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}
