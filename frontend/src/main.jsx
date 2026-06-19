import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bookmark,
  BookOpen,
  ExternalLink,
  Library,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const BASE_PATH = import.meta.env.BASE_URL;

const sampleArchives = [
  {
    id: "sample-1",
    url: "https://example.com/library",
    title: "静かな知識の森を歩くための断章",
    description: "保存された記憶が、後日の読書へと戻る道しるべになる。",
    og_image_url: "",
    favicon_url: `${BASE_PATH}icons/icon-192.png`,
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
  if (response.status === 204) return null;
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
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
  }, []);

  const selected = archives.find((archive) => archive.id === selectedId) || archives[0] || null;
  return { archives, selected, setSelectedId, loading, error, setArchives };
}

function App() {
  const { archives, selected, setSelectedId, loading, error, setArchives } = useArchives();
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

  const deleteArchive = async (archive) => {
    const ok = window.confirm(`「${archive.title}」を削除しますか？`);
    if (!ok) return;
    if (!archive.id.startsWith("sample-")) {
      await request(`/api/archives/${archive.id}`, { method: "DELETE" });
    }
    setArchives((current) => {
      const next = current.filter((item) => item.id !== archive.id);
      setSelectedId(next[0]?.id || null);
      return next;
    });
    setNotice("蔵書を削除しました。");
  };

  return (
    <main className="app-shell">
      <aside className="archive-rail">
        <div className="brand">
          <img className="brand-mark" src={`${BASE_PATH}icons/icon-192.png`} alt="" />
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
                <SiteIcon archive={archive} className="book-favicon" />
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
            onDelete={deleteArchive}
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

function SiteIcon({ archive, className = "" }) {
  const [attempt, setAttempt] = useState(0);

  // 画像の取得候補リスト（上から順に試します）
  const sources = [];

  // ① 最優先：バックエンド（司書）が取得してくれた本物のアイコンURL
  if (archive.favicon_url && archive.favicon_url.startsWith("http")) {
    sources.push(archive.favicon_url);
  }

  // フォールバック用のAPIを設定
  if (archive.url) {
    try {
      const parsed = new URL(archive.url);
      // ② DuckDuckGo（無い時はちゃんとエラーになるので2番目に最適）
      sources.push(`https://icons.duckduckgo.com/ip3/${parsed.hostname}.ico`);
      // ③ 最後の砦：Google（無い時は地球マークを返すので一番最後に回す）
      sources.push(`https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=128`);
    } catch (e) {
      // URLが不正な場合は無視
    }
  }

  // 候補を全て試し終わった（または候補が無い）場合は本のアイコンを表示
  if (attempt >= sources.length || sources.length === 0) {
    return <Library className={className} aria-hidden="true" />;
  }

  // 画像の読み込みに失敗(onError)するたびに、次の候補URLに切り替える
  return (
    <img
      className={className}
      src={sources[attempt]}
      alt=""
      onError={() => setAttempt((current) => current + 1)}
    />
  );
}

// fallbackFaviconUrl 関数はもう使わないので、削除してもOKです（残しておく場合は以下の通り空にしておきます）
function fallbackFaviconUrl() {
  return "";
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

function Reader({ archive, activeBookmark, setActiveBookmark, onMemoChange, onDelete }) {
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
        <div className="reader-actions">
          <button className="delete-button" type="button" onClick={() => onDelete(archive)} aria-label="この蔵書を削除">
            <Trash2 aria-hidden="true" />
          </button>
        </div>
        <div className="image-frame">
          <SiteIcon archive={archive} className="book-large-icon" />
        </div>
        <div className="source-meta">
          <SiteIcon archive={archive} className="detail-favicon" />
          <p className="date-line">{new Date(archive.created_at).toLocaleDateString("ja-JP")}</p>
        </div>
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
