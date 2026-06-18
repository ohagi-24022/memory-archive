from supabase import Client, create_client

from app.config import get_settings


class RepositoryNotConfigured(RuntimeError):
    pass


def get_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RepositoryNotConfigured("Supabase credentials are not configured.")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def _with_tags(row: dict) -> dict:
    archive_tags = row.pop("archive_tags", []) or []
    row["tags"] = [item["tags"]["name"] for item in archive_tags if item.get("tags")]
    return row


def list_archives() -> list[dict]:
    client = get_client()
    result = (
        client.table("archives")
        .select("*, archive_tags(tags(name))")
        .order("created_at", desc=True)
        .execute()
    )
    return [_with_tags(row) for row in result.data]


def get_archive(archive_id: str) -> dict | None:
    client = get_client()
    result = (
        client.table("archives")
        .select("*, archive_tags(tags(name))")
        .eq("id", archive_id)
        .maybe_single()
        .execute()
    )
    return _with_tags(result.data) if result.data else None


def create_archive(payload: dict, tags: list[str]) -> dict:
    client = get_client()
    inserted = client.table("archives").insert(payload).execute().data[0]
    sync_tags(inserted["id"], tags)
    return get_archive(inserted["id"]) or inserted


def update_archive(archive_id: str, payload: dict, tags: list[str] | None = None) -> dict | None:
    client = get_client()
    if payload:
        client.table("archives").update(payload).eq("id", archive_id).execute()
    if tags is not None:
        sync_tags(archive_id, tags)
    return get_archive(archive_id)


def delete_archive(archive_id: str) -> bool:
    client = get_client()
    existing = get_archive(archive_id)
    if not existing:
        return False
    client.table("archives").delete().eq("id", archive_id).execute()
    return True


def sync_tags(archive_id: str, tag_names: list[str]) -> None:
    client = get_client()
    client.table("archive_tags").delete().eq("archive_id", archive_id).execute()
    normalized = sorted({name.strip() for name in tag_names if name.strip()})
    for name in normalized:
        tag_result = client.table("tags").upsert({"name": name}, on_conflict="name").execute()
        tag_id = tag_result.data[0]["id"]
        client.table("archive_tags").insert({"archive_id": archive_id, "tag_id": tag_id}).execute()
