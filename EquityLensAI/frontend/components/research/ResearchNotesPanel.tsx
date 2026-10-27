'use client';

import { useState } from 'react';
import {
  useResearchNotes,
  useCreateResearchNote,
  useDeleteResearchNote,
} from '@/hooks/useResearch';
import type { NoteTag } from '@/services/api/research';

interface ResearchNotesPanelProps {
  projectId: string;
  reportId?: string;
  sectionId?: string;
}

export function ResearchNotesPanel({
  projectId,
  reportId,
  sectionId,
}: ResearchNotesPanelProps) {
  const { data: notesData, isLoading } = useResearchNotes(projectId);
  const createNoteMutation = useCreateResearchNote(projectId);
  const deleteNoteMutation = useDeleteResearchNote(projectId);

  const [content, setContent] = useState('');
  const [tag, setTag] = useState<NoteTag>('observation');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('all');

  const notes = notesData?.notes || [];
  const filteredNotes = notes.filter((n) => {
    if (filterTag !== 'all' && n.tag !== filterTag) return false;
    if (sectionId && n.sectionId !== sectionId) return false;
    return true;
  });

  const getTagBadgeClass = (noteTag: string) => {
    switch (noteTag) {
      case 'risk':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'assumption':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'question':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'observation':
      default:
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await createNoteMutation.mutateAsync({
        content: content.trim(),
        tag,
        reportId: reportId || null,
        sectionId: sectionId || null,
      });
      setContent('');
    } catch (err) {
      console.error('Failed to create note', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Delete this research note?')) return;
    try {
      await deleteNoteMutation.mutateAsync(noteId);
    } catch (err) {
      console.error('Failed to delete note', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            <h3 className="text-base font-bold text-white">Analyst Notes & Qualitative Findings</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            User-authored research observations, working assumptions, and risk queries. Preserved across all market data refreshes.
          </p>
        </div>

        {/* Tag Filters */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterTag('all')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              filterTag === 'all'
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({notes.length})
          </button>
          <button
            onClick={() => setFilterTag('observation')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              filterTag === 'observation'
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Observations
          </button>
          <button
            onClick={() => setFilterTag('assumption')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              filterTag === 'assumption'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Assumptions
          </button>
          <button
            onClick={() => setFilterTag('risk')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              filterTag === 'risk'
                ? 'bg-rose-500/20 text-rose-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Risks
          </button>
          <button
            onClick={() => setFilterTag('question')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              filterTag === 'question'
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Questions
          </button>
        </div>
      </div>

      {/* Add Note Form */}
      <form onSubmit={handleAddNote} className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400">Tag:</label>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as NoteTag)}
              className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="observation">Observation</option>
              <option value="assumption">Assumption</option>
              <option value="risk">Risk Factor</option>
              <option value="question">Open Question</option>
            </select>
          </div>

          <span className="text-[11px] text-slate-500 italic">
            Clearly labeled as user-authored in all exports
          </span>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter observation, management commentary note, or thesis assumption..."
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-slate-850 p-3 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="rounded-xl border border-indigo-500/30 bg-indigo-500/20 px-4 py-1.5 text-xs font-bold text-indigo-300 transition hover:bg-indigo-500/30 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </form>

      {/* Notes List */}
      <div className="flex flex-col gap-3">
        {isLoading && (
          <div className="h-20 animate-pulse rounded-2xl bg-slate-800/40" />
        )}

        {!isLoading && filteredNotes.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-500">
            No research notes recorded yet. Add your first observation or assumption above.
          </p>
        )}

        {!isLoading &&
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className="group relative flex flex-col gap-2 rounded-2xl border border-white/5 bg-slate-850/60 p-4 transition hover:border-white/15 hover:bg-slate-800/60"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTagBadgeClass(
                      note.tag,
                    )}`}
                  >
                    {note.tag}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {new Date(note.createdAt).toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 transition text-[11px] text-rose-400 hover:text-rose-300"
                  title="Delete note"
                >
                  Delete
                </button>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
