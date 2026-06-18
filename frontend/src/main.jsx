import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bookmark, BookOpen, ExternalLink, Library, Loader2, Plus, Save, Search, Sparkles } from "lucide-react";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const sampleArchives = [
  {
    id: "sample-1",
    url: "https://example.com/library",
    title: "静かな知識の森を歩くための断章",
    description: "保存された記憶が、後日の読書へと戻る道しるべになる。",
    og_image_url: "",
    summary: "・記憶は書架に収まり再読を待つ\n・要約は本質への細い灯である\n・メモは読者自身の余白を守る",
    user_memo: "あとで設計の比喩として読み返す。",
    tags: ["設計", "読書"],
    created_at: new Date().toISOString(),
  },
];

function parseSharedUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("url") || params.get("text") || "";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "通信に失敗しました");
  }
  return response.json();
}

function useArchives() {
  const [archives, setArchives] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request("/api/archives");
      setArchives(data);
      setSelectedId((current) => current || data[0]?.id || null);
    } catch (err) {
      setArchives(sampleArchives);
      setSelectedId("sample-1");
      setError("API未接続のため、サンプル蔵書を表示しています。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const selected = archives.find((archive) => archive.id === selectedId) || archives[0] || null;
  return { archives, selected, setSelectedId, loading, error, setArchives, reload: load };
}

function App() {
  const { archives, selected, setSelectedId, loading, error, setArchives, reload } = useArchives();
  const [url, setUrl] = useState(parseSharedUrl());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeBookmark, setActiveBookmark] = useState("summary");
  const [notice, setNotice] = useState("");

  const filteredArchives = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return archives;
    return archives.filter((archive) => {
      const haystack = `${archive.title} ${archive.description} ${archive.tags?.join(" ")}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [archives, query]);

  const saveUrl = async (event) => {
    event.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    setNotice("");
    try {
      const created = await request("/api/archive", {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), tags: [] }),
      });
      setArchives((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSelectedId(created.id);
      setUrl("");
      setNotice("新しい本を蔵書に収めました。");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateMemo = async (archive, userMemo) => {
    setArchives((current) => current.map((item) => (item.id === archive.id ? { ...item, user_memo: userMemo } : item)));
    if (archive.id.startsWith("sample-")) return;
    await request(`/api/archives/${archive.id}`, {
      method: "PATCH",
      body: JSON.stringify({ user_memo: userMemo }),
    });
  };

  return (
    <main className="app-shell">
      <aside className="archive-rail">
        <div className="brand">
          <Library aria-hidden="true" />
          <div>
            <p>記憶のアーカイブ</p>
            <h1>追憶ノ書架</h1>
          </div>
        </div>

        <form className="capture-form" onSubmit={saveUrl}>
          <label htmlFor="url-input">URL</label>
          <div className="capture-row">
            <input
              id="url-input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://..."
              inputMode="url"
            />
            <button type="submit" aria-label="蔵書に加える" disabled={saving}>
              {saving ? <Loader2 className="spin" /> : <Plus />}
            </button>
          </div>
        </form>

        <div className="search-box">
          <Search aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="書架を探す" />
        </div>

        {notice && <p className="notice">{notice}</p>}
        {error && <p className="notice muted">{error}</p>}

        <section className="shelf" aria-label="保存済みアーカイブ">
          {loading && <PageLoader />}
          {!loading &&
            filteredArchives.map((archive, index) => (
              <button
                className={`book-spine spine-${index % 5} ${selected?.id === archive.id ? "active" : ""}`}
                key={archive.id}
                onClick={() => setSelectedId(archive.id)}
              >
                <span className="book-title">{archive.title}</span>
                <span className="book-label">{archive.tags?.[0] || "未分類"}</span>
              </button>
            ))}
        </section>
      </aside>

      <section className="reading-room">
        {selected ? (
          <Reader
            archive={selected}
            activeBookmark={activeBookmark}
            setActiveBookmark={setActiveBookmark}
            onMemoChange={updateMemo}
            onReload={reload}
          />
        ) : (
          <div className="empty-page">
            <BookOpen aria-hidden="true" />
            <p>最初のURLを保存すると、ここに開かれた本が現れます。</p>
          </div>
        )}
      </section>
    </main>
  );
}

function PageLoader() {
  return (
    <div className="page-loader" aria-label="読み込み中">
      <span />
      <span />
      <span />
    </div>
  );
}

function Reader({ archive, activeBookmark, setActiveBookmark, onMemoChange }) {
  const [memo, setMemo] = useState(archive.user_memo || "");
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    setMemo(archive.user_memo || "");
    setSaved(true);
  }, [archive.id, archive.user_memo]);

  useEffect(() => {
    if (saved) return;
    const timer = window.setTimeout(async () => {
      await onMemoChange(archive, memo);
      setSaved(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [archive, memo, saved, onMemoChange]);

  return (
    <article className="open-book">
      <div className="bookmark-tabs" aria-label="栞">
        <button className={activeBookmark === "summary" ? "active" : ""} onClick={() => setActiveBookmark("summary")}>
          <Sparkles aria-hidden="true" />
          <span>司書</span>
        </button>
        <button className={activeBookmark === "memo" ? "active" : ""} onClick={() => setActiveBookmark("memo")}>
          <Bookmark aria-hidden="true" />
          <span>読者</span>
        </button>
      </div>

      <div className="page left-page">
        <div className="image-frame">
          {archive.og_image_url ? <img src={archive.og_image_url} alt="" /> : <BookOpen aria-hidden="true" />}
        </div>
        <p className="date-line">{new Date(archive.created_at).toLocaleDateString("ja-JP")}</p>
        <h2>{archive.title}</h2>
        <p className="description">{archive.description || "概要文はまだ綴じ込まれていません。"}</p>
        <a className="source-link" href={archive.url} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden="true" />
          元記事を開く
        </a>
        <div className="tag-row">
          {(archive.tags || []).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>

      <div className="page right-page">
        {activeBookmark === "summary" ? (
          <section className="bookmark-panel librarian">
            <h3>司書の栞</h3>
            <Typewriter text={archive.summary || "・要約はまだ作成されていない\n・本文の再取得が必要である\n・余白は次の読書を待つ"} />
          </section>
        ) : (
          <section className="bookmark-panel reader">
            <div className="memo-header">
              <h3>読者の栞</h3>
              <span>
                <Save aria-hidden="true" />
                {saved ? "保存済み" : "記録中"}
              </span>
            </div>
            <textarea
              value={memo}
              onChange={(event) => {
                setMemo(event.target.value);
                setSaved(false);
              }}
              placeholder="この本に挟んでおきたい考えを記す"
            />
          </section>
        )}
      </div>
    </article>
  );
}

function Typewriter({ text }) {
  const [visible, setVisible] = useState("");

  useEffect(() => {
    setVisible("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisible(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 18);
    return () => window.clearInterval(timer);
  }, [text]);

  return <pre>{visible}</pre>;
}

createRoot(document.getElementById("root")).render(<App />);

