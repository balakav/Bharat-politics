import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { Heart, MessageCircle, Repeat2, Send, Share2, Pencil, Trash2 } from "lucide-react";

// Social feed — every player can post, reply, like and share (tweet-style).

export default function Social() {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    (async () => {
      const me = await bharat01.auth.me().catch(() => null);
      if (me) {
        const ps = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
        if (ps[0]) setProfile(ps[0]);
      }
      await loadPosts();
      setLoading(false);
    })();
    const unsub = bharat01.entities.SocialPost.subscribe(() => loadPosts());
    return unsub;
  }, []);

  async function loadPosts() {
    const all = await bharat01.entities.SocialPost.list("-created_date", 200).catch(() => []);
    setPosts(all);
  }

  async function post() {
    if (!text.trim() || posting) return;
    setPosting(true);
    await bharat01.entities.SocialPost.create({
      author_id: profile?.player_id || "guest",
      author_name: profile?.username || "Guest",
      author_photo: profile?.photo_url || "",
      content: text.trim(),
      parent_id: "",
      likes: [],
      shares: 0,
    });
    setText("");
    setPosting(false);
    loadPosts();
  }

  async function reply() {
    if (!replyText.trim() || !replyTo) return;
    await bharat01.entities.SocialPost.create({
      author_id: profile?.player_id || "guest",
      author_name: profile?.username || "Guest",
      author_photo: profile?.photo_url || "",
      content: replyText.trim(),
      parent_id: replyTo,
      likes: [],
      shares: 0,
    });
    setReplyText("");
    setReplyTo(null);
    loadPosts();
  }

  async function toggleLike(p) {
    const id = profile?.player_id || "guest";
    const likes = (p.likes || []).includes(id) ? (p.likes || []).filter(x => x !== id) : [...(p.likes || []), id];
    setPosts(prev => prev.map(x => x.id === p.id ? { ...x, likes } : x));
    await bharat01.entities.SocialPost.update(p.id, { likes });
  }

  async function share(p) {
    setPosts(prev => prev.map(x => x.id === p.id ? { ...x, shares: (x.shares || 0) + 1 } : x));
    await bharat01.entities.SocialPost.update(p.id, { shares: (p.shares || 0) + 1 });
    if (navigator.share) { try { await navigator.share({ title: `${p.author_name} on Bharat Union`, text: p.content }); } catch (e) {} }
  }

  const isOwn = (p) => profile && p.author_id === profile.player_id;

  async function saveEdit(p) {
    if (!editText.trim()) return;
    await bharat01.entities.SocialPost.update(p.id, { content: editText.trim() });
    setEditingId(null); setEditText("");
    loadPosts();
  }

  async function removePost(p) {
    await bharat01.entities.SocialPost.delete(p.id);
    if (editingId === p.id) { setEditingId(null); setEditText(""); }
    loadPosts();
  }

  const topLevel = posts.filter(p => !p.parent_id);
  const repliesOf = id => posts.filter(p => p.parent_id === id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const Avatar = ({ p }) => p.author_photo ? (
    <img src={p.author_photo} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-zinc-700" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
      {(p.author_name || "P")[0].toUpperCase()}
    </div>
  );

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Share2 className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold text-white">Bharat Social</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Post, reply, like and share with every player in the Union</p>

      {/* Composer */}
      <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-4">
        <div className="flex gap-3">
          <Avatar p={{ author_photo: profile?.photo_url, author_name: profile?.username }} />
          <div className="flex-1">
            <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="What's happening in politics?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-orange-500" />
            <div className="flex justify-end mt-2">
              <button onClick={post} disabled={!text.trim() || posting}
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 disabled:opacity-50">
                <Send className="w-3.5 h-3.5" /> Post
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      {topLevel.length === 0 && (
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
          <Share2 className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-white">No posts yet</p>
          <p className="text-xs text-zinc-500 mt-1">Be the first to post!</p>
        </div>
      )}

      <div className="space-y-3">
        {topLevel.map(p => {
          const likes = p.likes || [];
          const liked = likes.includes(profile?.player_id || "guest");
          const replies = repliesOf(p.id);
          return (
            <div key={p.id} className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
              <div className="flex gap-3">
                <Avatar p={p} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-sm font-semibold text-white truncate">{p.author_name}</p>
                    <span className="text-[10px] text-zinc-600">· {new Date(p.created_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    {isOwn(p) && (
                      <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => { setEditingId(editingId === p.id ? null : p.id); setEditText(p.content); }}
                          className="text-zinc-500 hover:text-amber-400"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => removePost(p)} className="text-zinc-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </span>
                    )}
                  </div>
                  {editingId === p.id ? (
                    <div className="space-y-1.5">
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-orange-500" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="text-xs text-zinc-400 px-3 py-1">Cancel</button>
                        <button onClick={() => saveEdit(p)} disabled={!editText.trim()}
                          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full disabled:opacity-50">Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{p.content}</p>
                  )}
                  {/* Actions */}
                  <div className="flex items-center gap-5 mt-2.5">
                    <button onClick={() => toggleLike(p)} className={`flex items-center gap-1 text-xs ${liked ? "text-rose-400" : "text-zinc-500 hover:text-rose-400"}`}>
                      <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} /> {likes.length}
                    </button>
                    <button onClick={() => { setReplyTo(replyTo === p.id ? null : p.id); setReplyText(""); }}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-400">
                      <MessageCircle className="w-4 h-4" /> {replies.length}
                    </button>
                    <button onClick={() => share(p)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-green-400">
                      <Repeat2 className="w-4 h-4" /> {p.shares || 0}
                    </button>
                  </div>
                </div>
              </div>

              {/* Replies */}
              {(replies.length > 0 || replyTo === p.id) && (
                <div className="mt-3 pl-12 space-y-2">
                  {replies.map(r => (
                    <div key={r.id} className="flex gap-2">
                      <Avatar p={r} />
                      <div className="bg-zinc-800 rounded-xl px-3 py-2 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-white truncate">{r.author_name}</p>
                          {isOwn(r) && (
                            <button onClick={() => removePost(r)} className="ml-auto text-zinc-500 hover:text-red-400 flex-shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-zinc-300 break-words">{r.content}</p>
                      </div>
                    </div>
                  ))}
                  {replyTo === p.id && (
                    <div className="flex gap-2">
                      <input value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === "Enter" && reply()} placeholder="Write a reply..."
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500" />
                      <button onClick={reply} disabled={!replyText.trim()}
                        className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl px-3 disabled:opacity-50">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}