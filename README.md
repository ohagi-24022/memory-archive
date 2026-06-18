# 追憶ノ書架

Web上の記事、動画、SNS投稿を「本」として保存し、AI要約と自分のメモを「栞」として挟み込む、静かな知識のアーカイブアプリです。

## 構成

- `frontend`: React + Vite + PWA
- `backend`: FastAPI + Supabase + Gemini API
- `supabase`: PostgreSQL schema

## 起動方法

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

フロントエンドの既定 API は `http://localhost:8000` です。

## Supabase

`supabase/schema.sql` を Supabase SQL Editor で実行してください。

## 環境変数

Backend:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `CORS_ORIGINS`

Frontend:

- `VITE_API_BASE_URL`

