from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup


@dataclass
class ScrapedPage:
    url: str
    title: str
    description: str
    og_image_url: str | None
    favicon_url: str | None
    text: str


def _content(soup: BeautifulSoup, selector: str, attr: str = "content") -> str:
    tag = soup.select_one(selector)
    if not tag:
        return ""
    value = tag.get(attr)
    return str(value).strip() if value else ""


def _visible_text(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "noscript", "svg", "iframe"]):
        tag.decompose()

    candidates = soup.select("article, main")
    root = candidates[0] if candidates else soup.body or soup
    paragraphs = [p.get_text(" ", strip=True) for p in root.select("p, h1, h2, h3, li")]
    text = "\n".join(line for line in paragraphs if line)
    return text[:12000]


def _favicon_url(soup: BeautifulSoup, page_url: str) -> str | None:
    selectors = [
        "link[rel~='icon']",
        "link[rel='shortcut icon']",
        "link[rel='apple-touch-icon']",
        "link[rel='mask-icon']",
    ]
    for selector in selectors:
        tag = soup.select_one(selector)
        href = tag.get("href") if tag else ""
        if href:
            return urljoin(page_url, str(href).strip())

    parsed = urlparse(page_url)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}/favicon.ico"
    return None


async def scrape_page(url: str) -> ScrapedPage:
    headers = {
        "User-Agent": "TsuiokuNoShoka/1.0 (+https://local.app)",
        "Accept": "text/html,application/xhtml+xml",
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0, headers=headers) as client:
        response = await client.get(url)
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    title = _content(soup, "meta[property='og:title']") or (soup.title.string.strip() if soup.title and soup.title.string else "")
    description = _content(soup, "meta[property='og:description']") or _content(soup, "meta[name='description']")
    og_image = _content(soup, "meta[property='og:image']")
    if og_image:
        og_image = urljoin(str(response.url), og_image)

    return ScrapedPage(
        url=str(response.url),
        title=title or "無題の蔵書",
        description=description,
        og_image_url=og_image or None,
        favicon_url=_favicon_url(soup, str(response.url)),
        text=_visible_text(soup),
    )
