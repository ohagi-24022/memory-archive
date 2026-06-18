from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models import Archive, ArchiveCreate, ArchiveUpdate
from app.repository import RepositoryNotConfigured, create_archive, get_archive, list_archives, update_archive
from app.scraper import scrape_page
from app.summarizer import summarize_article

app = FastAPI(title="追憶ノ書架 API", version="0.1.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/archive", response_model=Archive)
async def post_archive(payload: ArchiveCreate) -> dict:
    try:
        page = await scrape_page(str(payload.url))
        summary = await summarize_article(page.title, page.description, page.text)
        return create_archive(
            {
                "url": page.url,
                "title": page.title,
                "description": page.description,
                "og_image_url": page.og_image_url,
                "summary": summary,
                "user_memo": "",
            },
            payload.tags,
        )
    except RepositoryNotConfigured as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Archive could not be saved: {exc}") from exc


@app.get("/api/archives", response_model=list[Archive])
def get_archives() -> list[dict]:
    try:
        return list_archives()
    except RepositoryNotConfigured as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/archives/{archive_id}", response_model=Archive)
def get_archive_detail(archive_id: str) -> dict:
    try:
        archive = get_archive(archive_id)
    except RepositoryNotConfigured as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    return archive


@app.patch("/api/archives/{archive_id}", response_model=Archive)
def patch_archive(archive_id: str, payload: ArchiveUpdate) -> dict:
    update_payload = payload.model_dump(exclude_unset=True, exclude={"tags"})
    try:
        archive = update_archive(archive_id, update_payload, payload.tags)
    except RepositoryNotConfigured as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    return archive

