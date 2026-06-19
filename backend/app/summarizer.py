import re

import google.generativeai as genai

from app.config import get_settings


SYSTEM_PROMPT = """あなたは歴史ある大図書館に務める、物静かで知的な司書です。
ユーザーから渡されたWeb記事のテキストを読み解き、蔵書に挟む「司書の栞」に記載するための要約を作成してください。

以下のルールを厳密に守ってください：
1. 文体は「だ・である」調を用い、客観的かつ文学的で、落ち着いたトーンにすること。
2. 要約は必ず3行、各行は「・」で始めること。
3. 絵文字や感嘆符は一切使用しないこと。
4. 1行あたり50文字以内とし、簡潔に本質を突くこと。
5. 「本文の主題を静かに記録した」「後の読書の入口となる蔵書である」のような汎用文を使わず、記事固有の内容に触れること。"""

GENERIC_LINES = {
    "・本文の主題を静かに記録した",
    "・後の読書の入口となる蔵書である",
    "本文の主題を静かに記録した",
    "後の読書の入口となる蔵書である",
}


def _fit_line(text: str, limit: int = 49) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip(" 。、\n\t")
    return cleaned[:limit] if cleaned else ""


def _sentence_candidates(title: str, description: str, text: str) -> list[str]:
    source = "\n".join(part for part in [description, text] if part)
    fragments = re.split(r"[。\n.!?！？]", source)
    candidates = [_fit_line(fragment) for fragment in fragments if _fit_line(fragment)]
    if title:
        candidates.insert(0, f"「{_fit_line(title, 40)}」を扱う記録である")
    return candidates


def _fallback_summary(title: str, description: str, text: str = "") -> str:
    candidates = _sentence_candidates(title, description, text)
    lines: list[str] = []
    seen: set[str] = set()

    for candidate in candidates:
        line = f"・{_fit_line(candidate)}"
        if line in seen or line in GENERIC_LINES:
            continue
        lines.append(line)
        seen.add(line)
        if len(lines) == 3:
            break

    while len(lines) < 3:
        fillers = [
            f"・保存元は{_fit_line(title or '未題のページ', 32)}である",
            f"・概要は{_fit_line(description or '本文抽出を待つ', 34)}である",
            "・詳細は元記事で確かめる記録である",
        ]
        for filler in fillers:
            if filler not in seen and filler not in GENERIC_LINES:
                lines.append(filler)
                seen.add(filler)
                break

    return "\n".join(lines[:3])


def _normalize_summary(summary: str, title: str, description: str, text: str) -> str:
    raw_lines = [line.strip() for line in summary.splitlines() if line.strip()]
    lines: list[str] = []
    seen: set[str] = set()

    for raw in raw_lines:
        line_body = raw[1:].strip() if raw.startswith(("・", "-", "•")) else raw
        line = f"・{_fit_line(line_body)}"
        if line in GENERIC_LINES or line in seen or len(line) <= 1:
            continue
        lines.append(line)
        seen.add(line)
        if len(lines) == 3:
            break

    if len(lines) < 3:
        for fallback in _fallback_summary(title, description, text).splitlines():
            if fallback not in seen and fallback not in GENERIC_LINES:
                lines.append(fallback)
                seen.add(fallback)
            if len(lines) == 3:
                break

    return "\n".join(lines[:3])


async def summarize_article(title: str, description: str, text: str) -> str:
    settings = get_settings()
    if not settings.gemini_api_key or not text.strip():
        return _fallback_summary(title, description, text)

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-2.5-flash", system_instruction=SYSTEM_PROMPT)
    prompt = f"タイトル: {title}\n概要: {description}\n本文:\n{text[:12000]}"
    response = await model.generate_content_async(prompt)
    summary = (response.text or "").strip()
    return _normalize_summary(summary, title, description, text)
