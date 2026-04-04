"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Trash2, Pin, PinOff, BookOpen, FileText,
  ChevronRight, ArrowLeft, Save, Smile, X, BarChart3
} from "lucide-react";
import { useNotesStore, Subject, Note, COLORS } from "@/store/useNotesStore";
import { useMaterialStore } from "@/store/useMaterialStore";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";

const EMOJIS = ["📚", "🧪", "🔢", "🌍", "💻", "🎨", "🏛️", "🧬", "⚗️", "📐", "🎵", "📖", "🌿", "🔬", "📝"];

// ===== Subject Card =====
function SubjectCard({ subject, noteCount, onClick, onDelete }: {
  subject: Subject;
  noteCount: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  const colorIdx = parseInt(subject.color) % COLORS.length;
  const c = COLORS[colorIdx];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-card border ${c.border} rounded-2xl p-5 cursor-pointer hover:border-opacity-60 transition-all group`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center text-xl`}>
          {subject.emoji}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <h3 className={`font-bold text-sm ${c.text} mb-1`}>{subject.name}</h3>
      <p className="text-xs text-muted-foreground">{noteCount} catatan</p>
      <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
        <span>Buka</span>
        <ChevronRight size={12} />
      </div>
    </motion.div>
  );
}

// ===== Note Editor =====
function NoteEditor({ note, onUpdate, onDelete, onBack }: {
  note: Note;
  onUpdate: (fields: Partial<Note>) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saved, setSaved] = useState(true);
  const saveTimeout = useRef<any>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setSaved(true);
  }, [note.id]);

  const handleChange = (newTitle: string, newContent: string) => {
    setSaved(false);
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      onUpdate({ title: newTitle, content: newContent });
      setSaved(true);
    }, 800);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Note Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${saved ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
          <span className="text-xs text-muted-foreground">{saved ? 'Tersimpan otomatis' : 'Menyimpan...'}</span>
        </div>
        <button
          onClick={() => { onUpdate({ isPinned: !note.isPinned }); }}
          className={`p-2 rounded-xl transition-colors ${note.isPinned ? 'bg-primary/20 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
          title={note.isPinned ? 'Unpin' : 'Pin catatan ini'}
        >
          {note.isPinned ? <Pin size={15} /> : <PinOff size={15} />}
        </button>
        <button onClick={onDelete} className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 size={15} />
        </button>
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={(e) => { setTitle(e.target.value); handleChange(e.target.value, content); }}
        placeholder="Judul catatan..."
        className="text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 mb-4 w-full"
      />
      <div className="h-px bg-border mb-4" />

      {/* Content */}
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); handleChange(title, e.target.value); }}
        placeholder={`Tulis catatanmu di sini...\n\n💡 Tips:\n• Gunakan baris baru untuk memisahkan poin\n• Salin poin penting dari Summary materi AI\n• Tulis pertanyaan yang muncul saat belajar`}
        className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/40 resize-none leading-relaxed w-full"
      />

      {/* Footer stats */}
      <div className="flex items-center gap-4 pt-3 border-t border-border text-xs text-muted-foreground">
        <span>{content.length} karakter</span>
        <span>{content.split(/\s+/).filter(Boolean).length} kata</span>
        <span>Diperbarui {new Date(note.updatedAt).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

// ===== Main Page =====
export default function MaterialsPage() {
  const {
    subjects, notes, activeSubjectId,
    addSubject, deleteSubject, setActiveSubject,
    addNote, updateNote, deleteNote, getNotesForSubject, searchNotes
  } = useNotesStore();
  const { materialHistory } = useMaterialStore();
  const { user } = useAuthStore();

  const displayHistory = user?.role === 'admin'
    ? materialHistory
    : materialHistory.filter(m => m.ownerId === user?.id);

  const [view, setView] = useState<'subjects' | 'notes' | 'editor'>('subjects');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectEmoji, setNewSubjectEmoji] = useState('📚');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const activeSubject = subjects.find((s) => s.id === activeSubjectId);
  const subjectNotes = activeSubjectId ? getNotesForSubject(activeSubjectId) : [];
  const activeNote = notes.find((n) => n.id === activeNoteId);
  const searchResults = searchNotes(searchQuery);

  const totalNotes = notes.length;

  const handleAddSubject = () => {
    if (!newSubjectName.trim()) return;
    addSubject(newSubjectName.trim(), newSubjectEmoji);
    setNewSubjectName('');
    setNewSubjectEmoji('📚');
    setShowAddSubject(false);
  };

  const handleCreateNote = () => {
    if (!activeSubjectId) return;
    const id = addNote(activeSubjectId, 'Catatan Baru');
    setActiveNoteId(id);
    setView('editor');
  };

  const handleOpenNote = (noteId: string) => {
    setActiveNoteId(noteId);
    setView('editor');
  };

  const handleDeleteNote = () => {
    if (!activeNoteId) return;
    deleteNote(activeNoteId);
    setActiveNoteId(null);
    setView('notes');
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto pb-10 gap-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            📂 Materials & Catatan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola catatan dan materi belajarmu dalam satu tempat
          </p>
        </div>
        {/* Stats */}
        <div className="hidden md:flex items-center gap-4">
          <div className="bg-card border border-border rounded-xl px-4 py-2 text-center">
            <p className="text-lg font-bold text-primary">{subjects.length}</p>
            <p className="text-xs text-muted-foreground">Mata Pelajaran</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-2 text-center">
            <p className="text-lg font-bold text-secondary">{totalNotes}</p>
            <p className="text-xs text-muted-foreground">Total Catatan</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-2 text-center">
            <p className="text-lg font-bold text-green-400">{displayHistory.length}</p>
            <p className="text-xs text-muted-foreground">Materi AI</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari catatan..."
          className="w-full h-11 pl-11 pr-4 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">{searchResults.length} hasil untuk "{searchQuery}"</p>
          </div>
          {searchResults.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Tidak ada catatan yang ditemukan</div>
          ) : (
            <div className="divide-y divide-border">
              {searchResults.map((note) => {
                const subj = subjects.find((s) => s.id === note.subjectId);
                return (
                  <div
                    key={note.id}
                    onClick={() => { setActiveSubject(note.subjectId); setView('notes'); handleOpenNote(note.id); setSearchQuery(''); }}
                    className="px-5 py-3 hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-muted-foreground">{subj?.emoji} {subj?.name}</span>
                      {note.isPinned && <Pin size={10} className="text-primary" />}
                    </div>
                    <p className="text-sm font-medium text-foreground">{note.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{note.content.substring(0, 80)}...</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!searchQuery && (
        <>
          {/* SUBJECTS VIEW */}
          {view === 'subjects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">Mata Pelajaran</h2>
                <button
                  onClick={() => setShowAddSubject(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all purple-glow"
                >
                  <Plus size={15} /> Tambah
                </button>
              </div>

              {/* Add Subject Form */}
              <AnimatePresence>
                {showAddSubject && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-card border border-primary/30 rounded-2xl p-5 space-y-4"
                  >
                    <h3 className="text-sm font-bold text-foreground">Mata Pelajaran Baru</h3>
                    <div className="flex gap-3">
                      {/* Emoji Picker */}
                      <div className="relative">
                        <button
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="w-11 h-11 rounded-xl bg-accent border border-border text-xl flex items-center justify-center hover:border-primary/50 transition-colors"
                        >
                          {newSubjectEmoji}
                        </button>
                        {showEmojiPicker && (
                          <div className="absolute top-12 left-0 z-10 bg-card border border-border rounded-xl p-3 grid grid-cols-5 gap-2 shadow-xl">
                            {EMOJIS.map((e) => (
                              <button
                                key={e}
                                onClick={() => { setNewSubjectEmoji(e); setShowEmojiPicker(false); }}
                                className="w-8 h-8 flex items-center justify-center hover:bg-accent rounded-lg text-lg transition-colors"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
                        placeholder="Nama mata pelajaran (mis: Matematika)"
                        className="flex-1 h-11 px-4 rounded-xl bg-accent/50 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddSubject} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all">
                        Tambah
                      </button>
                      <button onClick={() => setShowAddSubject(false)} className="px-4 py-2 bg-accent text-muted-foreground text-sm rounded-xl hover:text-foreground transition-colors">
                        Batal
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Subject Grid */}
              {subjects.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-2xl">📂</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Belum ada mata pelajaran</p>
                    <p className="text-xs text-muted-foreground mt-1">Tambahkan mata pelajaran pertamamu untuk mulai mencatat!</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {subjects.map((subject) => (
                    <SubjectCard
                      key={subject.id}
                      subject={subject}
                      noteCount={notes.filter((n) => n.subjectId === subject.id).length}
                      onClick={() => { setActiveSubject(subject.id); setView('notes'); }}
                      onDelete={() => deleteSubject(subject.id)}
                    />
                  ))}
                </div>
              )}

              {/* AI Materials Section */}
              <div className="mt-4">
                <h2 className="text-base font-bold text-foreground mb-3">Materi AI Tersimpan</h2>
                {displayHistory.length === 0 ? (
                  <div className="bg-card border border-border rounded-2xl p-8 text-center">
                    <p className="text-sm text-muted-foreground">Belum ada materi yang diproses AI. Upload PDF atau Youtube dari Dashboard!</p>
                    <Link href="/dashboard" className="inline-flex items-center gap-2 mt-3 text-sm text-primary hover:underline">
                      <Plus size={14} /> Upload Materi
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {displayHistory.map((item) => (
                      <Link
                        key={item.id}
                        href="/study-room"
                        onClick={() => useMaterialStore.getState().loadMaterial(item.id)}
                        className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-all flex items-center gap-4 group"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.sourceType === 'youtube' ? 'bg-red-500/15' : 'bg-primary/15'}`}>
                          <span className="text-lg">{item.sourceType === 'youtube' ? '▶️' : '📄'}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{item.title}</p>
                          <p className="text-xs text-muted-foreground">📓 {item.flashcards?.length} Kartu • ❓ {item.quiz?.length} Soal</p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NOTES LIST VIEW */}
          {view === 'notes' && activeSubject && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setView('subjects')} className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft size={16} />
                </button>
                <span className="text-xl">{activeSubject.emoji}</span>
                <h2 className="text-lg font-bold text-foreground flex-1">{activeSubject.name}</h2>
                <button
                  onClick={handleCreateNote}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all purple-glow"
                >
                  <Plus size={15} /> Catatan Baru
                </button>
              </div>

              {subjectNotes.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                    <FileText size={22} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Belum ada catatan</p>
                    <p className="text-xs text-muted-foreground mt-1">Klik "Catatan Baru" untuk mulai menulis!</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {subjectNotes.map((note) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleOpenNote(note.id)}
                      className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{note.title}</h3>
                        {note.isPinned && <Pin size={12} className="text-primary shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {note.content || "Ketuk untuk mulai menulis..."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(note.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NOTE EDITOR VIEW */}
          {view === 'editor' && activeNote && (
            <div className="bg-card border border-border rounded-2xl p-6 min-h-[500px] flex flex-col">
              <NoteEditor
                note={activeNote}
                onUpdate={(fields) => updateNote(activeNote.id, fields)}
                onDelete={handleDeleteNote}
                onBack={() => setView('notes')}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
